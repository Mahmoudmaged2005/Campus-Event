import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { notificationMessageSchema } from './notifications.schema.js';
import { sendEmail } from '../../shared/email.js';

const SUBJECT_LENGTH = 70;

function subjectFor(message) {
  if (message.length <= SUBJECT_LENGTH) {
    return message;
  }
  return message.slice(0, SUBJECT_LENGTH) + '...';
}

async function emailNotification(userId, message) {
  const user = await db().user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  if (user === null) {
    return;
  }
  const text = 'Hi ' + user.name + ',\n\n' + message + '\n\nCampus Events';
  await sendEmail(user.email, subjectFor(message), text);
}

export async function createNotification(userId, message) {
  const checkedMessage = notificationMessageSchema.safeParse(message);
  if (!checkedMessage.success) {
    throw new AppError(400, checkedMessage.error.issues[0].message);
  }
  const notification = await db().notification.create({
    data: { userId: userId, message: checkedMessage.data },
  });
  await emailNotification(userId, checkedMessage.data);
  return notification;
}

export async function listMyNotifications(userId) {
  return db().notification.findMany({
    where: { userId: userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function markAsRead(notificationId, userId) {
  const notification = await db().notification.findUnique({ where: { id: notificationId } });
  if (notification === null || notification.userId !== userId) {
    throw new AppError(404, 'Notification not found');
  }
  return db().notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}
