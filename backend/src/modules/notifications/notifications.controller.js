import { AppError } from '../../shared/errors.js';
import * as notificationsService from './notifications.service.js';

function readNotificationId(req) {
  const notificationId = Number(req.params.id);
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    throw new AppError(400, 'The notification id must be a positive whole number');
  }
  return notificationId;
}

export async function listMine(req, res) {
  const notifications = await notificationsService.listMyNotifications(req.user.id);
  res.json({ notifications: notifications });
}

export async function markRead(req, res) {
  const notification = await notificationsService.markAsRead(readNotificationId(req), req.user.id);
  res.json({ notification: notification });
}
