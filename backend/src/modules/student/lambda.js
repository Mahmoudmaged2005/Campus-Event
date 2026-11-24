import serverless from 'serverless-http';
import { makeApp } from '../../app.js';
import { studentRouter } from './student.routes.js';
import { sendDueReminders } from './reminders.service.js';
import { sendWeeklyDigests } from './digest.service.js';

const app = makeApp([{ path: '/api/student', router: studentRouter }]);

export const handler = serverless(app);

export async function remindersHandler() {
  return sendDueReminders();
}

export async function digestHandler() {
  return sendWeeklyDigests();
}
