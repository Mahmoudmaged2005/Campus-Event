import { db } from '../../db/client.js';

const pointsLostPerResolvedFlag = 10;

async function findEventIdsOfOrganizer(organizerId) {
  const events = await db().event.findMany({ where: { organizerId: organizerId }, select: { id: true } });
  const eventIds = [];
  for (const event of events) {
    eventIds.push(event.id);
  }
  return eventIds;
}

async function countReviews(action, eventIds) {
  return db().auditLog.count({
    where: { action: action, entityType: 'Event', entityId: { in: eventIds } },
  });
}

function levelForScore(score) {
  if (score >= 80) {
    return 'TRUSTED';
  }
  if (score >= 50) {
    return 'NORMAL';
  }
  return 'LOW';
}

export async function getTrustScore(organizerId) {
  const eventIds = await findEventIdsOfOrganizer(organizerId);
  const approvedCount = await countReviews('event.approved', eventIds);
  const rejectedCount = await countReviews('event.rejected', eventIds);
  const resolvedFlagCount = await db().flag.count({
    where: { status: 'RESOLVED', eventId: { in: eventIds } },
  });

  const reviewedCount = approvedCount + rejectedCount;
  if (reviewedCount === 0) {
    return { score: null, level: 'NEW', approvedCount: 0, rejectedCount: 0, resolvedFlagCount: resolvedFlagCount };
  }

  let score = Math.round((approvedCount * 100) / reviewedCount);
  score = score - resolvedFlagCount * pointsLostPerResolvedFlag;
  if (score < 0) {
    score = 0;
  }

  return {
    score: score,
    level: levelForScore(score),
    approvedCount: approvedCount,
    rejectedCount: rejectedCount,
    resolvedFlagCount: resolvedFlagCount,
  };
}
