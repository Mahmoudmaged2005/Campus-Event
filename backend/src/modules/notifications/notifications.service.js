import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { notificationMessageSchema } from './notifications.schema.js';

export async function createNotification(userId, message) {
  const checkedMessage = notificationMessageSchema.safeParse(message);
  if (!checkedMessage.success) {
    throw new AppError(400, checkedMessage.error.issues[0].message);
  }
  return db().notification.create({
    data: { userId: userId, message: checkedMessage.data },
  });
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
