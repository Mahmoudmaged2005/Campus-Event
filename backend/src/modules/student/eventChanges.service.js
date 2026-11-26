import { db } from '../../db/client.js';
import { cairoParts, cairoDateText } from '../../shared/cairoTime.js';
import { createNotification } from '../notifications/notifications.service.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { listRegisteredStudentIds } from './registration.service.js';

function twoDigits(number) {
  return String(number).padStart(2, '0');
}

function cairoWhenText(date) {
  const parts = cairoParts(date);
  return cairoDateText(date) + ' at ' + twoDigits(parts.hour) + ':' + twoDigits(parts.minute) + ' (Cairo time)';
}

async function sendToStudents(studentIds, message) {
  for (const studentId of studentIds) {
    await createNotification(studentId, message);
  }
}

async function removeUnsentReminders(eventId) {
  const reminders = await db().reminder.findMany({
    where: { eventId: eventId, sentAt: null },
    select: { userId: true },
  });
  await db().reminder.deleteMany({ where: { eventId: eventId, sentAt: null } });
  const studentIds = [];
  for (const reminder of reminders) {
    if (!studentIds.includes(reminder.userId)) {
      studentIds.push(reminder.userId);
    }
  }
  return studentIds;
}

export async function notifyEventCancelled(eventId) {
  const event = await db().event.findUnique({ where: { id: eventId } });
  if (event === null) {
    return 0;
  }
  const studentIds = await listRegisteredStudentIds(eventId);
  await removeUnsentReminders(eventId);
  const message = '"' + event.title + '" on ' + cairoWhenText(event.startsAt) + ' was cancelled.';
  await sendToStudents(studentIds, message);
  await writeAuditLog(null, 'students.notified', 'Event', eventId, { reason: 'event.cancelled', studentCount: studentIds.length });
  return studentIds.length;
}

export async function notifyEventRescheduled(eventId) {
  const event = await db().event.findUnique({ where: { id: eventId } });
  if (event === null || event.status !== 'APPROVED') {
    return 0;
  }
  const registeredIds = await listRegisteredStudentIds(eventId);
  const reminderIds = await removeUnsentReminders(eventId);
  const movedText = '"' + event.title + '" was moved to ' + cairoWhenText(event.startsAt) + ' in ' + event.location + '.';
  let notifiedCount = 0;
  for (const studentId of registeredIds) {
    let message = movedText;
    if (reminderIds.includes(studentId)) {
      message = message + ' Your reminder was removed, please set it again.';
    }
    await createNotification(studentId, message);
    notifiedCount = notifiedCount + 1;
  }
  for (const studentId of reminderIds) {
    if (!registeredIds.includes(studentId)) {
      await createNotification(studentId, movedText + ' Your reminder was removed, please set it again.');
      notifiedCount = notifiedCount + 1;
    }
  }
  await writeAuditLog(null, 'students.notified', 'Event', eventId, { reason: 'event.rescheduled', studentCount: notifiedCount });
  return notifiedCount;
}

export async function handleEventMessage(message) {
  const eventId = Number(message.data.eventId);
  if (message.type === 'event.cancelled') {
    return notifyEventCancelled(eventId);
  }
  if (message.type === 'event.rescheduled') {
    return notifyEventRescheduled(eventId);
  }
  return 0;
}
