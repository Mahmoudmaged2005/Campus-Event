import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';

const ONE_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 31;
const MAX_DAYS = 100;

function readRange(fromText, toText) {
  let from = new Date();
  if (fromText) {
    from = new Date(fromText);
  }
  let to = new Date(from.getTime() + DEFAULT_DAYS * ONE_DAY);
  if (toText) {
    to = new Date(toText);
  }
  if (to <= from) {
    throw new AppError(400, 'to must be after from');
  }
  if (to.getTime() - from.getTime() > MAX_DAYS * ONE_DAY) {
    throw new AppError(400, 'You can ask for at most ' + MAX_DAYS + ' days at once');
  }
  return { from: from, to: to };
}

async function findStudentEventIds(table, studentId, eventIds) {
  const rows = await db()[table].findMany({
    where: { userId: studentId, eventId: { in: eventIds } },
    select: { eventId: true },
  });
  const ids = [];
  for (const row of rows) {
    ids.push(row.eventId);
  }
  return ids;
}

export async function browseEvents(studentId, filters) {
  const range = readRange(filters.from, filters.to);
  const where = {
    status: { in: ['APPROVED', 'CANCELLED'] },
    startsAt: { gte: range.from, lt: range.to },
    category: { isActive: true },
  };
  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  const events = await db().event.findMany({
    where: where,
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { registrations: true } },
    },
    orderBy: { startsAt: 'asc' },
  });
  const eventIds = [];
  for (const event of events) {
    eventIds.push(event.id);
  }
  const savedIds = await findStudentEventIds('savedEvent', studentId, eventIds);
  const registeredIds = await findStudentEventIds('registration', studentId, eventIds);
  const result = [];
  for (const event of events) {
    result.push({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      capacity: event.capacity,
      status: event.status,
      imageUrl: event.imageUrl,
      category: event.category,
      registeredCount: event._count.registrations,
      isSaved: savedIds.includes(event.id),
      isRegistered: registeredIds.includes(event.id),
    });
  }
  return result;
}
