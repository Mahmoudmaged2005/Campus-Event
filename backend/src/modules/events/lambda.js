import serverless from 'serverless-http';
import { makeApp } from '../../app.js';
import { eventsRouter } from './events.routes.js';

const app = makeApp([{ path: '/api/events', router: eventsRouter }]);

export const handler = serverless(app);
