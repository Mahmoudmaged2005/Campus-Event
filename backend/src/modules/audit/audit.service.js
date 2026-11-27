import { db } from '../../db/client.js';

export async function writeAuditLog(actorId, action, entityType, entityId, details) {
  return db().auditLog.create({
    data: {
      actorId: actorId,
      action: action,
      entityType: entityType,
      entityId: entityId,
      details: details,
    },
  });
}

export async function listAuditLogs(filters) {
  const where = {};
  if (filters.action) {
    where.action = filters.action;
  }
  if (filters.beforeId) {
    where.id = { lt: filters.beforeId };
  }
  const entries = await db().auditLog.findMany({
    where: where,
    include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { id: 'desc' },
    take: filters.limit,
  });
  let nextBeforeId = null;
  if (entries.length === filters.limit) {
    nextBeforeId = entries[entries.length - 1].id;
  }
  return { entries: entries, nextBeforeId: nextBeforeId };
}
