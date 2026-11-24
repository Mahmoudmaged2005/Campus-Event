import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';

const includeCategoryAndOrganizer = {
  category: { select: { id: true, name: true } },
  organizer: { select: { id: true, name: true, email: true } },
};

export async function listReviewQueue() {
  return db().event.findMany({
    where: { status: 'PENDING' },
    include: includeCategoryAndOrganizer,
    orderBy: { createdAt: 'asc' },
  });
}

async function findPendingEvent(eventId) {
  const event = await db().event.findUnique({ where: { id: eventId } });
  if (event === null) {
    throw new AppError(404, 'Event not found');
  }
  if (event.status !== 'PENDING') {
    throw new AppError(409, 'Only pending events can be reviewed. This event is ' + event.status);
  }
  return event;
}

export async function approveEvent(eventId) {
  await findPendingEvent(eventId);
  return db().event.update({
    where: { id: eventId },
    data: { status: 'APPROVED', rejectionReason: null },
    include: includeCategoryAndOrganizer,
  });
}

export async function rejectEvent(eventId, reason) {
  await findPendingEvent(eventId);
  return db().event.update({
    where: { id: eventId },
    data: { status: 'REJECTED', rejectionReason: reason },
    include: includeCategoryAndOrganizer,
  });
}
