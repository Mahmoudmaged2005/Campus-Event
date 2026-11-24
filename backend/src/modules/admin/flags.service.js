import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { writeAuditLog } from '../audit/audit.service.js';

const includeEventAndReporter = {
  event: { select: { id: true, title: true, status: true, organizerId: true } },
  reporter: { select: { id: true, name: true, email: true } },
};

export async function listOpenFlags() {
  return db().flag.findMany({
    where: { status: 'OPEN' },
    include: includeEventAndReporter,
    orderBy: { createdAt: 'asc' },
  });
}

async function findOpenFlag(flagId) {
  const flag = await db().flag.findUnique({ where: { id: flagId }, include: includeEventAndReporter });
  if (flag === null) {
    throw new AppError(404, 'Flag not found');
  }
  if (flag.status !== 'OPEN') {
    throw new AppError(409, 'Only open flags can be handled. This flag is ' + flag.status);
  }
  return flag;
}

async function cancelEventIfApproved(event) {
  if (event.status !== 'APPROVED') {
    return false;
  }
  await db().event.update({ where: { id: event.id }, data: { status: 'CANCELLED' } });
  return true;
}

export async function resolveFlag(adminId, flagId) {
  const flag = await findOpenFlag(flagId);
  const eventCancelled = await cancelEventIfApproved(flag.event);
  await db().flag.updateMany({
    where: { eventId: flag.eventId, status: 'OPEN' },
    data: { status: 'RESOLVED' },
  });
  await writeAuditLog(adminId, 'flag.resolved', 'Flag', flagId, {
    eventId: flag.eventId,
    eventTitle: flag.event.title,
    reason: flag.reason,
    eventCancelled: eventCancelled,
  });
  return db().flag.findUnique({ where: { id: flagId }, include: includeEventAndReporter });
}

export async function dismissFlag(adminId, flagId) {
  const flag = await findOpenFlag(flagId);
  const dismissedFlag = await db().flag.update({
    where: { id: flagId },
    data: { status: 'DISMISSED' },
    include: includeEventAndReporter,
  });
  await writeAuditLog(adminId, 'flag.dismissed', 'Flag', flagId, {
    eventId: flag.eventId,
    eventTitle: flag.event.title,
    reason: flag.reason,
  });
  return dismissedFlag;
}
