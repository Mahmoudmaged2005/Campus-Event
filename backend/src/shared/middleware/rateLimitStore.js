import { db } from '../../db/client.js';

const CLEAN_UP_EVERY = 100;

export function databaseCounterStore(limiterName) {
  let windowMs = 60 * 1000;
  let countsSinceCleanUp = 0;

  function currentWindow() {
    const windowNumber = Math.floor(Date.now() / windowMs);
    return { windowNumber: windowNumber, resetTime: new Date((windowNumber + 1) * windowMs) };
  }

  function counterKey(clientKey, windowNumber) {
    return limiterName + ':' + clientKey + ':' + windowNumber;
  }

  async function removeOldCounters() {
    countsSinceCleanUp = countsSinceCleanUp + 1;
    if (countsSinceCleanUp < CLEAN_UP_EVERY) {
      return;
    }
    countsSinceCleanUp = 0;
    const olderThanTwoWindows = new Date(Date.now() - windowMs);
    await db().rateLimitCounter.deleteMany({ where: { resetAt: { lt: olderThanTwoWindows } } });
  }

  async function previousWindowHits(clientKey, windowNumber) {
    const previous = await db().rateLimitCounter.findUnique({ where: { key: counterKey(clientKey, windowNumber - 1) } });
    if (previous === null) {
      return 0;
    }
    return previous.hits;
  }

  function slidingTotal(currentHits, previousHits, windowNumber) {
    const passedShare = (Date.now() - windowNumber * windowMs) / windowMs;
    return currentHits + Math.floor(previousHits * (1 - passedShare));
  }

  async function increment(clientKey) {
    const window = currentWindow();
    const key = counterKey(clientKey, window.windowNumber);
    const counter = await db().rateLimitCounter.upsert({
      where: { key: key },
      create: { key: key, hits: 1, resetAt: window.resetTime },
      update: { hits: { increment: 1 } },
    });
    const previousHits = await previousWindowHits(clientKey, window.windowNumber);
    await removeOldCounters();
    return { totalHits: slidingTotal(counter.hits, previousHits, window.windowNumber), resetTime: window.resetTime };
  }

  async function decrement(clientKey) {
    const window = currentWindow();
    await db().rateLimitCounter.updateMany({
      where: { key: counterKey(clientKey, window.windowNumber) },
      data: { hits: { decrement: 1 } },
    });
  }

  async function resetKey(clientKey) {
    await db().rateLimitCounter.deleteMany({ where: { key: { startsWith: limiterName + ':' + clientKey + ':' } } });
  }

  function init(options) {
    windowMs = options.windowMs;
  }

  return { init: init, increment: increment, decrement: decrement, resetKey: resetKey, localKeys: false };
}
