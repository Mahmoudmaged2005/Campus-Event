import serverless from 'serverless-http';
import { makeApp } from '../../app.js';
import { authRouter } from './auth.routes.js';
import { checkGatewayToken } from './authorizer.service.js';

const app = makeApp([{ path: '/api/auth', router: authRouter }]);

export const handler = serverless(app);

export async function authorizerHandler(event) {
  return checkGatewayToken(event.authorizationToken, event.methodArn);
}
