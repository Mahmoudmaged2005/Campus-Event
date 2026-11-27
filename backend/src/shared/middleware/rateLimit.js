import { rateLimit } from 'express-rate-limit';
import { databaseCounterStore } from './rateLimitStore.js';

const ONE_MINUTE = 60 * 1000;
const DEFAULT_API_LIMIT = 100;

function apiLimit() {
  const fromSettings = Number(process.env.RATE_LIMIT_MAX);
  if (Number.isInteger(fromSettings) && fromSettings > 0) {
    return fromSettings;
  }
  return DEFAULT_API_LIMIT;
}

function skipApiLimit(req) {
  if (process.env.NODE_TEST_CONTEXT !== undefined) {
    return true;
  }
  return req.path === '/api/health';
}

function chooseStore(limiterName) {
  if (process.env.RATE_LIMIT_STORE === 'database') {
    return databaseCounterStore(limiterName);
  }
  return undefined;
}

export const loginRateLimit = rateLimit({
  windowMs: ONE_MINUTE,
  limit: 10,
  store: chooseStore('login'),
  passOnStoreError: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please wait a minute' },
});

export const apiRateLimit = rateLimit({
  windowMs: ONE_MINUTE,
  limit: apiLimit(),
  skip: skipApiLimit,
  store: chooseStore('api'),
  passOnStoreError: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please wait a minute' },
});
