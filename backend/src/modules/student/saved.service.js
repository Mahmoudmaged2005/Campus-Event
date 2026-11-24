import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { findOpenEvent } from './registration.service.js';

const includeEventDetails = {
  event: { include: { category: { select: { id: true, name: true } } } },
};

async function findSavedEvent(eventId, studentId) {
  return db().savedEvent.findUnique({
    where: { eventId_userId: { eventId: eventId, userId: studentId } },
  });
}

export async function saveEvent(eventId, studentId) {
  await findOpenEvent(eventId);
  const existing = await findSavedEvent(eventId, studentId);
  if (existing !== null) {
    throw new AppError(409, 'You already saved this event');
  }
  try {
    return await db().savedEvent.create({
      data: { eventId: eventId, userId: studentId },
      include: includeEventDetails,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'You already saved this event');
    }
    throw error;
  }
}

export async function unsaveEvent(eventId, studentId) {
  const existing = await findSavedEvent(eventId, studentId);
  if (existing === null) {
    throw new AppError(404, 'This event is not in your saved events');
  }
  await db().savedEvent.delete({ where: { id: existing.id } });
  return { result: 'unsaved' };
}

export async function listMySavedEvents(studentId) {
  return db().savedEvent.findMany({
    where: { userId: studentId },
    include: includeEventDetails,
    orderBy: { event: { startsAt: 'asc' } },
  });
}
