import serverless from 'serverless-http';
import { makeApp } from '../../app.js';
import { authRouter } from './auth.routes.js';

const app = makeApp([{ path: '/api/auth', router: authRouter }]);

export const handler = serverless(app);
