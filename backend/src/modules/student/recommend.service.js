import { db } from '../../db/client.js';
import { listFollowedCategories } from './follow.service.js';
import { listMySavedEvents } from './saved.service.js';
import { listMyRegistrations } from './registration.service.js';

const RECOMMENDATION_LIMIT = 10;

function addEventInterest(interests, event) {
  interests.knownEventIds.push(event.id);
  interests.likedCategoryIds.push(event.categoryId);
}

export async function collectInterests(studentId) {
  const interests = { followedCategoryIds: [], likedCategoryIds: [], knownEventIds: [] };
  const followedCategories = await listFollowedCategories(studentId);
  for (const category of followedCategories) {
    interests.followedCategoryIds.push(category.id);
  }
  const savedEvents = await listMySavedEvents(studentId);
  for (const savedEvent of savedEvents) {
    addEventInterest(interests, savedEvent.event);
  }
  const registrations = await listMyRegistrations(studentId);
  for (const registration of registrations) {
    addEventInterest(interests, registration.event);
  }
  return interests;
}

function recommendationReason(event, interests) {
  if (interests.followedCategoryIds.includes(event.categoryId)) {
    return 'You follow ' + event.category.name;
  }
  return 'Like other ' + event.category.name + ' events you saved or registered for';
}

export async function recommendEvents(studentId) {
  const interests = await collectInterests(studentId);
  const categoryIds = interests.followedCategoryIds.concat(interests.likedCategoryIds);
  if (categoryIds.length === 0) {
    return [];
  }
  const events = await db().event.findMany({
    where: {
      status: 'APPROVED',
      startsAt: { gt: new Date() },
      categoryId: { in: categoryIds },
      category: { isActive: true },
      id: { notIn: interests.knownEventIds },
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { startsAt: 'asc' },
    take: RECOMMENDATION_LIMIT,
  });
  const recommendations = [];
  for (const event of events) {
    recommendations.push({ event: event, reason: recommendationReason(event, interests) });
  }
  return recommendations;
}
