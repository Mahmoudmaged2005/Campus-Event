import crypto from 'node:crypto';
import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { cairoParts, cairoLocalToDate } from '../../shared/cairoTime.js';
import { findClashes } from './clash.service.js';
import { checkTimes, checkCategory } from './events.service.js';

const MAX_SERIES_EVENT_HOURS = 24;
const ONE_HOUR = 60 * 60 * 1000;

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftLocalDate(firstDate, frequency, steps) {
  if (frequency === 'MONTHLY') {
    const monthStart = new Date(Date.UTC(firstDate.year, firstDate.month - 1 + steps, 1));
    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth() + 1;
    const day = Math.min(firstDate.day, daysInMonth(year, month));
    return { year: year, month: month, day: day };
  }
  let daysToAdd = steps;
  if (frequency === 'WEEKLY') {
    daysToAdd = steps * 7;
  }
  const shifted = new Date(Date.UTC(firstDate.year, firstDate.month - 1, firstDate.day + daysToAdd));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function buildSeriesDates(input) {
  const first = cairoParts(input.startsAt);
  const duration = input.endsAt.getTime() - input.startsAt.getTime();
  const dates = [];
  for (let index = 0; index < input.count; index++) {
    const localDate = shiftLocalDate(first, input.frequency, index * input.interval);
    const startsAt = cairoLocalToDate(localDate.year, localDate.month, localDate.day, first.hour, first.minute);
    dates.push({ startsAt: startsAt, endsAt: new Date(startsAt.getTime() + duration) });
  }
  return dates;
}

function checkSeriesInput(input) {
  checkTimes(input.startsAt, input.endsAt);
  if (input.endsAt.getTime() - input.startsAt.getTime() > MAX_SERIES_EVENT_HOURS * ONE_HOUR) {
    throw new AppError(400, 'An event in a series can last at most 24 hours');
  }
}

async function checkEveryDate(location, dates) {
  const checkedDates = [];
  for (const date of dates) {
    const clashes = await findClashes(location, date.startsAt, date.endsAt);
    checkedDates.push({
      startsAt: date.startsAt,
      endsAt: date.endsAt,
      free: clashes.length === 0,
      clashes: clashes,
    });
  }
  return checkedDates;
}

export async function previewSeries(input) {
  checkSeriesInput(input);
  const checkedDates = await checkEveryDate(input.location, buildSeriesDates(input));
  let freeCount = 0;
  for (const checkedDate of checkedDates) {
    if (checkedDate.free) {
      freeCount = freeCount + 1;
    }
  }
  return { dates: checkedDates, freeCount: freeCount, clashCount: checkedDates.length - freeCount };
}

function splitFreeAndClashing(checkedDates, onClash) {
  const freeDates = [];
  const clashingDates = [];
  for (const checkedDate of checkedDates) {
    if (checkedDate.free) {
      freeDates.push(checkedDate);
    } else {
      clashingDates.push(checkedDate);
    }
  }
  if (onClash === 'reject' && clashingDates.length > 0) {
    throw new AppError(409, 'Some dates are already booked, nothing was created', { clashingDates: clashingDates });
  }
  if (freeDates.length === 0) {
    throw new AppError(409, 'Every date in the series is already booked', { clashingDates: clashingDates });
  }
  return { freeDates: freeDates, clashingDates: clashingDates };
}

function buildCreateQuery(organizerId, input, seriesId, date) {
  return db().event.create({
    data: {
      title: input.title,
      description: input.description,
      location: input.location,
      startsAt: date.startsAt,
      endsAt: date.endsAt,
      capacity: input.capacity,
      categoryId: input.categoryId,
      organizerId: organizerId,
      status: 'PENDING',
      seriesId: seriesId,
    },
  });
}

export async function createSeries(organizerId, input) {
  checkSeriesInput(input);
  await checkCategory(input.categoryId);
  const checkedDates = await checkEveryDate(input.location, buildSeriesDates(input));
  const split = splitFreeAndClashing(checkedDates, input.onClash);

  const seriesId = crypto.randomUUID();
  const createQueries = [];
  for (const date of split.freeDates) {
    createQueries.push(buildCreateQuery(organizerId, input, seriesId, date));
  }
  const createdEvents = await db().$transaction(createQueries);
  return { seriesId: seriesId, created: createdEvents, skipped: split.clashingDates };
}
