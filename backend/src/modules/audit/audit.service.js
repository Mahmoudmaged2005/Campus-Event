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
