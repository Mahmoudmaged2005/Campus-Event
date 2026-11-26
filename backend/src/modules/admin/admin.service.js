import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { getTrustScore } from './trust.service.js';
import { publishMessage } from '../../shared/messaging.js';

const includeCategoryAndOrganizer = {
  category: { select: { id: true, name: true } },
  organizer: { select: { id: true, name: true, email: true } },
};

export async function listReviewQueue() {
  const events = await db().event.findMany({
    where: { status: 'PENDING' },
    include: includeCategoryAndOrganizer,
    orderBy: { createdAt: 'asc' },
  });

  const trustByOrganizerId = {};
  for (const event of events) {
    if (trustByOrganizerId[event.organizerId] === undefined) {
      trustByOrganizerId[event.organizerId] = await getTrustScore(event.organizerId);
    }
    event.organizerTrust = trustByOrganizerId[event.organizerId];
  }
  return events;
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

export async function approveEvent(eventId, adminId) {
  const event = await findPendingEvent(eventId);
  const approvedEvent = await db().event.update({
    where: { id: eventId },
    data: { status: 'APPROVED', rejectionReason: null },
    include: includeCategoryAndOrganizer,
  });
  await writeAuditLog(adminId, 'event.approved', 'Event', eventId, {
    title: event.title,
    organizerId: event.organizerId,
  });
  await publishMessage('event.approved', { eventId: eventId, organizerId: event.organizerId });
  return approvedEvent;
}

export async function rejectEvent(eventId, adminId, reason) {
  const event = await findPendingEvent(eventId);
  const rejectedEvent = await db().event.update({
    where: { id: eventId },
    data: { status: 'REJECTED', rejectionReason: reason },
    include: includeCategoryAndOrganizer,
  });
  await writeAuditLog(adminId, 'event.rejected', 'Event', eventId, {
    title: event.title,
    organizerId: event.organizerId,
    reason: reason,
  });
  await publishMessage('event.rejected', { eventId: eventId, organizerId: event.organizerId });
  return rejectedEvent;
}
