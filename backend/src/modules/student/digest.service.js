import { db } from '../../db/client.js';
import { cairoDateText } from '../../shared/cairoTime.js';
import { createNotification } from '../notifications/notifications.service.js';
import { listFollowedCategories } from './follow.service.js';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const EVENTS_IN_MESSAGE = 3;

async function findWeekEvents(studentId, weekStart, weekEnd) {
  const followedCategories = await listFollowedCategories(studentId);
  const categoryIds = [];
  for (const category of followedCategories) {
    categoryIds.push(category.id);
  }
  if (categoryIds.length === 0) {
    return [];
  }
  return db().event.findMany({
    where: {
      status: 'APPROVED',
      startsAt: { gt: weekStart, lte: weekEnd },
      categoryId: { in: categoryIds },
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { startsAt: 'asc' },
  });
}

export async function getMyDigest(studentId) {
  const weekStart = new Date();
  const weekEnd = new Date(weekStart.getTime() + SEVEN_DAYS);
  const events = await findWeekEvents(studentId, weekStart, weekEnd);
  return { from: weekStart, to: weekEnd, events: events };
}

function digestMessage(events) {
  let message = 'This week: ' + events.length + ' event(s) in categories you follow: ';
  let shownCount = events.length;
  if (shownCount > EVENTS_IN_MESSAGE) {
    shownCount = EVENTS_IN_MESSAGE;
  }
  for (let index = 0; index < shownCount; index = index + 1) {
    if (index > 0) {
      message = message + '; ';
    }
    message = message + events[index].title + ' on ' + cairoDateText(events[index].startsAt);
  }
  if (events.length > shownCount) {
    message = message + ' and ' + (events.length - shownCount) + ' more';
  }
  return message;
}

export async function sendWeeklyDigests() {
  const weekStart = new Date();
  const weekEnd = new Date(weekStart.getTime() + SEVEN_DAYS);
  const students = await db().user.findMany({
    where: { role: 'STUDENT', followedCategories: { some: {} } },
    select: { id: true },
  });
  let sentCount = 0;
  for (const student of students) {
    const events = await findWeekEvents(student.id, weekStart, weekEnd);
    if (events.length > 0) {
      await createNotification(student.id, digestMessage(events));
      sentCount = sentCount + 1;
    }
  }
  return { studentCount: students.length, sentCount: sentCount };
}
