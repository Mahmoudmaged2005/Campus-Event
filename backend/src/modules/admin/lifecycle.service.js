import { db } from '../../db/client.js';
import { writeAuditLog } from '../audit/audit.service.js';

export async function completePastEvents(actorId) {
  const now = new Date();
  const result = await db().event.updateMany({
    where: { status: 'APPROVED', endsAt: { lt: now } },
    data: { status: 'COMPLETED' },
  });

  if (result.count > 0) {
    await writeAuditLog(actorId, 'events.completed', 'Event', null, {
      completedCount: result.count,
      ranAt: now.toISOString(),
    });
  }

  return { completedCount: result.count };
}
