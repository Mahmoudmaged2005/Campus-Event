import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { cairoMinutesOfDay, cairoDateText } from '../../shared/cairoTime.js';

const ACTIVE_STATUSES = ['PENDING', 'APPROVED'];
const CAMPUS_OPENS_AT_MINUTE = 8 * 60;
const CAMPUS_CLOSES_AT_MINUTE = 22 * 60;
const STEP_MINUTES = 30;
const SEARCH_DAYS = 7;
const MAX_SUGGESTIONS = 3;
const ONE_MINUTE = 60 * 1000;
const ONE_DAY = 24 * 60 * ONE_MINUTE;

function overlapFilter(startsAt, endsAt, ignoreEventId) {
  const where = {
    status: { in: ACTIVE_STATUSES },
    startsAt: { lt: endsAt },
    endsAt: { gt: startsAt },
  };
  if (ignoreEventId) {
    where.id = { not: ignoreEventId };
  }
  return where;
}

function sameLocation(location) {
  return { equals: location, mode: 'insensitive' };
}

export async function findClashes(location, startsAt, endsAt, ignoreEventId) {
  const where = overlapFilter(startsAt, endsAt, ignoreEventId);
  where.location = sameLocation(location);
  return db().event.findMany({
    where: where,
    select: { id: true, title: true, location: true, startsAt: true, endsAt: true, status: true },
    orderBy: { startsAt: 'asc' },
  });
}

function fitsInCampusDay(startsAt, endsAt) {
  if (cairoDateText(startsAt) !== cairoDateText(endsAt)) {
    return false;
  }
  if (cairoMinutesOfDay(startsAt) < CAMPUS_OPENS_AT_MINUTE) {
    return false;
  }
  return cairoMinutesOfDay(endsAt) <= CAMPUS_CLOSES_AT_MINUTE;
}

function slotIsFree(startsAt, endsAt, busyEvents) {
  if (startsAt <= new Date()) {
    return false;
  }
  if (!fitsInCampusDay(startsAt, endsAt)) {
    return false;
  }
  for (const busyEvent of busyEvents) {
    if (startsAt < busyEvent.endsAt && endsAt > busyEvent.startsAt) {
      return false;
    }
  }
  return true;
}

async function findBusyEventsNear(location, startsAt, ignoreEventId) {
  const searchFrom = new Date(startsAt.getTime() - (SEARCH_DAYS + 1) * ONE_DAY);
  const searchTo = new Date(startsAt.getTime() + (SEARCH_DAYS + 1) * ONE_DAY);
  const where = overlapFilter(searchFrom, searchTo, ignoreEventId);
  where.location = sameLocation(location);
  return db().event.findMany({ where: where, select: { startsAt: true, endsAt: true } });
}

async function suggestFreeSlots(location, startsAt, endsAt, ignoreEventId) {
  const busyEvents = await findBusyEventsNear(location, startsAt, ignoreEventId);
  const duration = endsAt.getTime() - startsAt.getTime();
  const maxSteps = (SEARCH_DAYS * 24 * 60) / STEP_MINUTES;
  const slots = [];
  for (let step = 1; step <= maxSteps && slots.length < MAX_SUGGESTIONS; step++) {
    const shift = step * STEP_MINUTES * ONE_MINUTE;
    const candidateStarts = [startsAt.getTime() + shift, startsAt.getTime() - shift];
    for (const candidateStart of candidateStarts) {
      const slotStart = new Date(candidateStart);
      const slotEnd = new Date(candidateStart + duration);
      if (slots.length < MAX_SUGGESTIONS && slotIsFree(slotStart, slotEnd, busyEvents)) {
        slots.push({ startsAt: slotStart, endsAt: slotEnd });
      }
    }
  }
  return slots;
}

async function suggestFreePlaces(location, startsAt, endsAt, ignoreEventId) {
  const knownPlaces = await db().event.findMany({
    distinct: ['location'],
    select: { location: true },
    orderBy: { location: 'asc' },
  });
  const busyEvents = await db().event.findMany({
    where: overlapFilter(startsAt, endsAt, ignoreEventId),
    select: { location: true },
  });
  const takenNames = new Set([location.toLowerCase()]);
  for (const busyEvent of busyEvents) {
    takenNames.add(busyEvent.location.toLowerCase());
  }
  const places = [];
  for (const place of knownPlaces) {
    const lowerName = place.location.toLowerCase();
    if (places.length < MAX_SUGGESTIONS && !takenNames.has(lowerName)) {
      places.push(place.location);
      takenNames.add(lowerName);
    }
  }
  return places;
}

export async function checkPlaceAndTime(location, startsAt, endsAt, ignoreEventId) {
  const clashes = await findClashes(location, startsAt, endsAt, ignoreEventId);
  if (clashes.length === 0) {
    return { free: true };
  }
  const slots = await suggestFreeSlots(location, startsAt, endsAt, ignoreEventId);
  const places = await suggestFreePlaces(location, startsAt, endsAt, ignoreEventId);
  return { free: false, clashes: clashes, alternatives: { slots: slots, places: places } };
}

export async function ensureNoClash(location, startsAt, endsAt, ignoreEventId) {
  const result = await checkPlaceAndTime(location, startsAt, endsAt, ignoreEventId);
  if (!result.free) {
    throw new AppError(409, 'This place is already booked at that time', {
      clashes: result.clashes,
      alternatives: result.alternatives,
    });
  }
}
