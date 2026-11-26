import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { writeAuditLog } from '../audit/audit.service.js';

async function findApprovedEvent(eventId) {
  const event = await db().event.findUnique({ where: { id: eventId } });
  if (event === null || event.status !== 'APPROVED') {
    throw new AppError(404, 'Event not found');
  }
  return event;
}

async function checkNoOpenReport(eventId, studentId) {
  const openReport = await db().flag.findFirst({
    where: { eventId: eventId, reporterId: studentId, status: 'OPEN' },
  });
  if (openReport !== null) {
    throw new AppError(409, 'You already reported this event, an admin will look at it');
  }
}

export async function reportEvent(eventId, studentId, reason) {
  const event = await findApprovedEvent(eventId);
  await checkNoOpenReport(eventId, studentId);
  const flag = await db().flag.create({
    data: { eventId: eventId, reporterId: studentId, reason: reason },
  });
  await writeAuditLog(studentId, 'flag.created', 'Flag', flag.id, {
    eventId: eventId,
    eventTitle: event.title,
  });
  return flag;
}
