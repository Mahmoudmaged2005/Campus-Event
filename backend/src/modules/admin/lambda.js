import serverless from 'serverless-http';
import { makeApp } from '../../app.js';
import { adminRouter } from './admin.routes.js';
import { completePastEvents } from './lifecycle.service.js';

const app = makeApp([{ path: '/api/admin', router: adminRouter }]);

export const handler = serverless(app);

export async function lifecycleHandler() {
  return completePastEvents(null);
}
