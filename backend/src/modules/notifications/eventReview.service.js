import { db } from '../../db/client.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { createNotification } from './notifications.service.js';

const MAX_REASON_LENGTH = 300;

function shortReason(reason) {
  if (!reason) {
    return 'no reason was given';
  }
  if (reason.length <= MAX_REASON_LENGTH) {
    return reason;
  }
  return reason.slice(0, MAX_REASON_LENGTH) + '...';
}

async function findEventWithStatus(eventId, status) {
  const event = await db().event.findUnique({ where: { id: eventId } });
  if (event === null || event.status !== status) {
    return null;
  }
  return event;
}

export async function notifyOrganizerApproved(eventId) {
  const event = await findEventWithStatus(eventId, 'APPROVED');
  if (event === null) {
    return 0;
  }
  await createNotification(event.organizerId, 'Your event "' + event.title + '" was approved.');
  await writeAuditLog(null, 'organizer.notified', 'Event', eventId, { reason: 'event.approved' });
  return 1;
}

export async function notifyOrganizerRejected(eventId) {
  const event = await findEventWithStatus(eventId, 'REJECTED');
  if (event === null) {
    return 0;
  }
  const message = 'Your event "' + event.title + '" was rejected: ' + shortReason(event.rejectionReason);
  await createNotification(event.organizerId, message);
  await writeAuditLog(null, 'organizer.notified', 'Event', eventId, { reason: 'event.rejected' });
  return 1;
}

export async function handleReviewMessage(message) {
  const eventId = Number(message.data.eventId);
  if (message.type === 'event.approved') {
    return notifyOrganizerApproved(eventId);
  }
  if (message.type === 'event.rejected') {
    return notifyOrganizerRejected(eventId);
  }
  return 0;
}
