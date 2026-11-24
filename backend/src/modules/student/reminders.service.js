import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { cairoParts, cairoDateText } from '../../shared/cairoTime.js';
import { createNotification } from '../notifications/notifications.service.js';
import { findOpenEvent, findRegistration } from './registration.service.js';
import { findSavedEvent } from './saved.service.js';
import { getWeatherForDate, weatherShortText } from './weather.service.js';

const ONE_MINUTE = 60 * 1000;

const includeEventDetails = {
  event: { select: { id: true, title: true, location: true, startsAt: true, status: true } },
};

async function checkSavedOrRegistered(eventId, studentId) {
  const registration = await findRegistration(eventId, studentId);
  if (registration !== null) {
    return;
  }
  const savedEvent = await findSavedEvent(eventId, studentId);
  if (savedEvent !== null) {
    return;
  }
  throw new AppError(409, 'Save or register for this event first, then add a reminder');
}

async function checkNoSameReminder(eventId, studentId, remindAt) {
  const sameReminder = await db().reminder.findFirst({
    where: { eventId: eventId, userId: studentId, remindAt: remindAt },
  });
  if (sameReminder !== null) {
    throw new AppError(409, 'You already have a reminder at this time for this event');
  }
}

export async function createReminder(eventId, studentId, minutesBefore) {
  const event = await findOpenEvent(eventId);
  await checkSavedOrRegistered(eventId, studentId);
  const remindAt = new Date(event.startsAt.getTime() - minutesBefore * ONE_MINUTE);
  if (remindAt <= new Date()) {
    throw new AppError(409, 'That reminder time has already passed, choose fewer minutes');
  }
  await checkNoSameReminder(eventId, studentId, remindAt);
  return db().reminder.create({
    data: { eventId: eventId, userId: studentId, remindAt: remindAt },
    include: includeEventDetails,
  });
}

export async function listMyReminders(studentId) {
  return db().reminder.findMany({
    where: { userId: studentId },
    include: includeEventDetails,
    orderBy: { remindAt: 'asc' },
  });
}

export async function deleteReminder(reminderId, studentId) {
  const reminder = await db().reminder.findUnique({ where: { id: reminderId } });
  if (reminder === null || reminder.userId !== studentId) {
    throw new AppError(404, 'Reminder not found');
  }
  await db().reminder.delete({ where: { id: reminderId } });
  return { result: 'deleted' };
}

function twoDigits(number) {
  return String(number).padStart(2, '0');
}

async function weatherLine(event) {
  try {
    const weather = await getWeatherForDate(event.startsAt);
    if (weather.available) {
      return '. Weather: ' + weatherShortText(weather);
    }
    return '';
  } catch (error) {
    return '';
  }
}

async function reminderMessage(event) {
  const parts = cairoParts(event.startsAt);
  const clockText = twoDigits(parts.hour) + ':' + twoDigits(parts.minute);
  const weatherText = await weatherLine(event);
  return (
    'Reminder: "' + event.title + '" starts on ' + cairoDateText(event.startsAt) +
    ' at ' + clockText + ' (Cairo time) in ' + event.location + weatherText
  );
}

async function sendOneReminder(reminder, now) {
  const claimed = await db().reminder.updateMany({
    where: { id: reminder.id, sentAt: null },
    data: { sentAt: now },
  });
  if (claimed.count === 0) {
    return false;
  }
  if (reminder.event.status !== 'APPROVED' || reminder.event.startsAt <= now) {
    return false;
  }
  const message = await reminderMessage(reminder.event);
  await createNotification(reminder.userId, message);
  return true;
}

export async function sendDueReminders() {
  const now = new Date();
  const dueReminders = await db().reminder.findMany({
    where: { sentAt: null, remindAt: { lte: now } },
    include: includeEventDetails,
  });
  let sentCount = 0;
  for (const reminder of dueReminders) {
    const wasSent = await sendOneReminder(reminder, now);
    if (wasSent) {
      sentCount = sentCount + 1;
    }
  }
  return { dueCount: dueReminders.length, sentCount: sentCount };
}
