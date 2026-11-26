import serverless from 'serverless-http';
import { makeApp } from '../../app.js';
import { notificationsRouter } from './notifications.routes.js';
import { handleReviewMessage } from './eventReview.service.js';
import { readQueueMessages } from '../../shared/messaging.js';

const app = makeApp([{ path: '/api/notifications', router: notificationsRouter }]);

export const handler = serverless(app);

export async function notificationsQueueHandler(queueEvent) {
  const messages = readQueueMessages(queueEvent);
  let notifiedCount = 0;
  for (const message of messages) {
    notifiedCount = notifiedCount + (await handleReviewMessage(message));
  }
  return { messageCount: messages.length, notifiedCount: notifiedCount };
}
