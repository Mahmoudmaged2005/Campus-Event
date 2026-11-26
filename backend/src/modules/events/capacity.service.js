import { getEventForUser } from './events.service.js';
import { countRegistrations } from '../student/registration.service.js';

const ALMOST_FULL_PERCENT = 80;

function countText(count, singleWord, manyWord) {
  if (count === 1) {
    return '1 ' + singleWord;
  }
  return count + ' ' + manyWord;
}

function noLimitAdvice(registeredCount) {
  return {
    capacity: null,
    registeredCount: registeredCount,
    placesLeft: null,
    percentFull: null,
    advice: 'NO_LIMIT',
    adviceText: countText(registeredCount, 'student', 'students') + ' registered. This event has no place limit.',
  };
}

function chooseAdvice(placesLeft, percentFull) {
  const placesText = countText(placesLeft, 'place', 'places') + ' left.';
  if (placesLeft === 0) {
    return { advice: 'FULL', adviceText: 'Full. Think about a bigger room or a second session.' };
  }
  if (percentFull >= ALMOST_FULL_PERCENT) {
    return { advice: 'ALMOST_FULL', adviceText: 'Almost full: ' + placesText };
  }
  return { advice: 'OK', adviceText: placesText };
}

export async function getCapacityAdvice(eventId, user) {
  const event = await getEventForUser(eventId, user);
  const registeredCount = await countRegistrations(eventId);
  if (event.capacity === null) {
    return noLimitAdvice(registeredCount);
  }
  let placesLeft = event.capacity - registeredCount;
  if (placesLeft < 0) {
    placesLeft = 0;
  }
  const percentFull = Math.round((registeredCount / event.capacity) * 100);
  const chosen = chooseAdvice(placesLeft, percentFull);
  return {
    capacity: event.capacity,
    registeredCount: registeredCount,
    placesLeft: placesLeft,
    percentFull: percentFull,
    advice: chosen.advice,
    adviceText: chosen.adviceText,
  };
}
