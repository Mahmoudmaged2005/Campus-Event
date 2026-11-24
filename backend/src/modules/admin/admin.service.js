import { db } from '../../db/client.js';

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
