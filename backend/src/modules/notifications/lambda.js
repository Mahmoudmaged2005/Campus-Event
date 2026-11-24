import serverless from 'serverless-http';
import { makeApp } from '../../app.js';
import { notificationsRouter } from './notifications.routes.js';

const app = makeApp([{ path: '/api/notifications', router: notificationsRouter }]);

export const handler = serverless(app);
