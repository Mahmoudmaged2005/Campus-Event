import serverless from 'serverless-http';
import { makeApp } from '../../app.js';
import { studentRouter } from './student.routes.js';

const app = makeApp([{ path: '/api/student', router: studentRouter }]);

export const handler = serverless(app);
