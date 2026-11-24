import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { ensureNoClash, checkPlaceAndTime } from './clash.service.js';
import { deleteImageByUrl } from './imageStorage.js';
import { publishMessage } from '../../shared/messaging.js';

const includeCategory = { category: { select: { id: true, name: true } } };

export function checkTimes(startsAt, endsAt) {
  if (endsAt <= startsAt) {
    throw new AppError(400, 'The end time must be after the start time');
  }
  if (startsAt <= new Date()) {
    throw new AppError(400, 'The start time must be in the future');
  }
}

export async function checkCategory(categoryId) {
  const category = await db().category.findUnique({ where: { id: categoryId } });
  if (category === null || !category.isActive) {
    throw new AppError(400, 'This category does not exist or is not active');
  }
}

export async function findOwnedEvent(eventId, organizerId) {
  const event = await db().event.findUnique({ where: { id: eventId } });
  if (event === null || event.organizerId !== organizerId) {
    throw new AppError(404, 'Event not found');
  }
  return event;
}

function mergePlaceAndTime(event, changes) {
  const merged = { location: event.location, startsAt: event.startsAt, endsAt: event.endsAt };
  if (changes.location !== undefined) {
    merged.location = changes.location;
  }
  if (changes.startsAt !== undefined) {
    merged.startsAt = changes.startsAt;
  }
  if (changes.endsAt !== undefined) {
    merged.endsAt = changes.endsAt;
  }
  return merged;
}

export function checkCanEdit(event) {
  if (event.status === 'APPROVED') {
    throw new AppError(409, 'Approved events cannot be edited');
  }
  if (event.status !== 'PENDING' && event.status !== 'REJECTED') {
    throw new AppError(409, 'This event cannot be edited because it is ' + event.status);
  }
}

export async function listActiveCategories() {
  return db().category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function listMyEvents(organizerId) {
  return db().event.findMany({
    where: { organizerId: organizerId },
    include: includeCategory,
    orderBy: { startsAt: 'asc' },
  });
}

export async function getEventForUser(eventId, user) {
  const event = await db().event.findUnique({ where: { id: eventId }, include: includeCategory });
  if (event === null) {
    throw new AppError(404, 'Event not found');
  }
  if (user.role !== 'ADMIN' && event.organizerId !== user.id) {
    throw new AppError(404, 'Event not found');
  }
  return event;
}

export async function checkAvailability(input) {
  checkTimes(input.startsAt, input.endsAt);
  return checkPlaceAndTime(input.location, input.startsAt, input.endsAt, input.ignoreEventId);
}

export async function createEvent(organizerId, input) {
  checkTimes(input.startsAt, input.endsAt);
  await checkCategory(input.categoryId);
  await ensureNoClash(input.location, input.startsAt, input.endsAt);
  return db().event.create({
    data: {
      title: input.title,
      description: input.description,
      location: input.location,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      categoryId: input.categoryId,
      organizerId: organizerId,
      status: 'PENDING',
    },
    include: includeCategory,
  });
}

export async function updateEvent(eventId, organizerId, changes) {
  const event = await findOwnedEvent(eventId, organizerId);
  checkCanEdit(event);

  const placeAndTime = mergePlaceAndTime(event, changes);
  if (changes.startsAt !== undefined || changes.endsAt !== undefined) {
    checkTimes(placeAndTime.startsAt, placeAndTime.endsAt);
  }
  if (changes.categoryId !== undefined) {
    await checkCategory(changes.categoryId);
  }
  await ensureNoClash(placeAndTime.location, placeAndTime.startsAt, placeAndTime.endsAt, eventId);

  const data = { ...changes };
  if (event.status === 'REJECTED') {
    data.status = 'PENDING';
    data.rejectionReason = null;
  }
  return db().event.update({ where: { id: eventId }, data: data, include: includeCategory });
}

export async function deleteEvent(eventId, organizerId) {
  const event = await findOwnedEvent(eventId, organizerId);

  if (event.status === 'PENDING' || event.status === 'REJECTED') {
    await db().event.delete({ where: { id: eventId } });
    if (event.imageUrl) {
      await deleteImageByUrl(event.imageUrl);
    }
    return { result: 'deleted' };
  }
  if (event.status === 'APPROVED') {
    const cancelledEvent = await db().event.update({
      where: { id: eventId },
      data: { status: 'CANCELLED' },
      include: includeCategory,
    });
    await publishMessage('event.cancelled', { eventId: eventId, organizerId: organizerId });
    return { result: 'cancelled', event: cancelledEvent };
  }
  throw new AppError(409, 'This event cannot be deleted because it is ' + event.status);
}
