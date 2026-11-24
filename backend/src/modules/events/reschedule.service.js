import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { publishMessage } from '../../shared/messaging.js';
import { findOwnedEvent, checkTimes } from './events.service.js';
import { checkPlaceAndTime, ensureNoClash } from './clash.service.js';
import { listRegisteredStudentIds } from '../student/registration.service.js';

const includeCategory = { category: { select: { id: true, name: true } } };

function isSameTime(event, newTimes) {
  const sameStart = event.startsAt.getTime() === newTimes.startsAt.getTime();
  const sameEnd = event.endsAt.getTime() === newTimes.endsAt.getTime();
  return sameStart && sameEnd;
}

async function findEventToReschedule(eventId, organizerId, newTimes) {
  const event = await findOwnedEvent(eventId, organizerId);
  if (event.status !== 'APPROVED') {
    throw new AppError(409, 'Only approved events can be rescheduled. This event is ' + event.status);
  }
  if (event.startsAt <= new Date()) {
    throw new AppError(409, 'This event has already started and cannot be rescheduled');
  }
  checkTimes(newTimes.startsAt, newTimes.endsAt);
  if (isSameTime(event, newTimes)) {
    throw new AppError(400, 'The new time is the same as the current time');
  }
  return event;
}

export async function previewReschedule(eventId, organizerId, newTimes) {
  const event = await findEventToReschedule(eventId, organizerId, newTimes);
  const placeCheck = await checkPlaceAndTime(event.location, newTimes.startsAt, newTimes.endsAt, eventId);
  const studentIds = await listRegisteredStudentIds(eventId);
  const preview = {
    oldStartsAt: event.startsAt,
    oldEndsAt: event.endsAt,
    newStartsAt: newTimes.startsAt,
    newEndsAt: newTimes.endsAt,
    affectedStudents: studentIds.length,
    free: placeCheck.free,
  };
  if (!placeCheck.free) {
    preview.clashes = placeCheck.clashes;
    preview.alternatives = placeCheck.alternatives;
  }
  return preview;
}

export async function rescheduleEvent(eventId, organizerId, newTimes) {
  const event = await findEventToReschedule(eventId, organizerId, newTimes);
  await ensureNoClash(event.location, newTimes.startsAt, newTimes.endsAt, eventId);
  const studentIds = await listRegisteredStudentIds(eventId);
  const movedEvent = await db().event.update({
    where: { id: eventId },
    data: { startsAt: newTimes.startsAt, endsAt: newTimes.endsAt },
    include: includeCategory,
  });
  await publishMessage('event.rescheduled', { eventId: eventId, organizerId: organizerId });
  return { event: movedEvent, affectedStudents: studentIds.length };
}
