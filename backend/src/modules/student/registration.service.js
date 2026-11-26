import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { sendEmail } from '../../shared/email.js';
import { cairoDateText, cairoClockText } from '../../shared/cairoTime.js';

const includeEventDetails = {
  event: { include: { category: { select: { id: true, name: true } } } },
};

export async function findRegistration(eventId, studentId) {
  return db().registration.findUnique({
    where: { eventId_userId: { eventId: eventId, userId: studentId } },
  });
}

export async function findOpenEvent(eventId) {
  const event = await db().event.findUnique({ where: { id: eventId } });
  if (event === null || event.status !== 'APPROVED') {
    throw new AppError(404, 'Event not found');
  }
  if (event.startsAt <= new Date()) {
    throw new AppError(409, 'This event has already started');
  }
  return event;
}

async function checkCapacity(event) {
  if (event.capacity === null) {
    return;
  }
  const registeredCount = await countRegistrations(event.id);
  if (registeredCount >= event.capacity) {
    throw new AppError(409, 'This event is full');
  }
}

async function createRegistration(eventId, studentId) {
  try {
    return await db().registration.create({
      data: { eventId: eventId, userId: studentId },
      include: includeEventDetails,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'You are already registered for this event');
    }
    throw error;
  }
}

export async function countRegistrations(eventId) {
  return db().registration.count({ where: { eventId: eventId } });
}

export async function listRegisteredStudentIds(eventId) {
  const registrations = await db().registration.findMany({
    where: { eventId: eventId },
    select: { userId: true },
  });
  const studentIds = [];
  for (const registration of registrations) {
    studentIds.push(registration.userId);
  }
  return studentIds;
}

async function emailRegistration(event, studentId) {
  const student = await db().user.findUnique({ where: { id: studentId }, select: { name: true, email: true } });
  const when = cairoDateText(event.startsAt) + ' at ' + cairoClockText(event.startsAt) + ' (Cairo time)';
  const text =
    'Hi ' + student.name + ',\n\n' +
    'You are registered for "' + event.title + '".\n' +
    'When: ' + when + '\n' +
    'Where: ' + event.location + '\n\n' +
    'Campus Events';
  await sendEmail(student.email, 'You are registered for ' + event.title, text);
}

export async function registerForEvent(eventId, studentId) {
  const event = await findOpenEvent(eventId);
  const existing = await findRegistration(eventId, studentId);
  if (existing !== null) {
    throw new AppError(409, 'You are already registered for this event');
  }
  await checkCapacity(event);
  const registration = await createRegistration(eventId, studentId);
  await writeAuditLog(studentId, 'registration.created', 'Event', eventId, null);
  await emailRegistration(event, studentId);
  return registration;
}

export async function cancelRegistration(eventId, studentId) {
  const existing = await findRegistration(eventId, studentId);
  if (existing === null) {
    throw new AppError(404, 'You are not registered for this event');
  }
  const event = await db().event.findUnique({ where: { id: eventId } });
  if (event.startsAt <= new Date()) {
    throw new AppError(409, 'This event has already started, you cannot cancel now');
  }
  await db().registration.delete({ where: { id: existing.id } });
  await writeAuditLog(studentId, 'registration.cancelled', 'Event', eventId, null);
  return { result: 'cancelled' };
}

export async function listMyRegistrations(studentId) {
  return db().registration.findMany({
    where: { userId: studentId },
    include: includeEventDetails,
    orderBy: { event: { startsAt: 'asc' } },
  });
}
