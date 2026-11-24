import serverless from 'serverless-http';
import { makeApp } from '../../app.js';
import { adminRouter } from './admin.routes.js';

const app = makeApp([{ path: '/api/admin', router: adminRouter }]);

export const handler = serverless(app);
