import serverless from 'serverless-http';
import { makeApp } from '../../app.js';
import { studentRouter } from './student.routes.js';
import { sendDueReminders } from './reminders.service.js';
import { sendWeeklyDigests } from './digest.service.js';
import { handleEventMessage } from './eventChanges.service.js';
import { readQueueMessages } from '../../shared/messaging.js';

const app = makeApp([{ path: '/api/student', router: studentRouter }]);

export const handler = serverless(app);

export async function remindersHandler() {
  return sendDueReminders();
}

export async function digestHandler() {
  return sendWeeklyDigests();
}

export async function studentQueueHandler(queueEvent) {
  const messages = readQueueMessages(queueEvent);
  let notifiedCount = 0;
  for (const message of messages) {
    notifiedCount = notifiedCount + (await handleEventMessage(message));
  }
  return { messageCount: messages.length, notifiedCount: notifiedCount };
}
