import { findSessionByToken } from './auth.service.js';

const BEARER = 'Bearer ';

function tokenFromHeader(header) {
  if (!header || !header.startsWith(BEARER)) {
    return '';
  }
  return header.slice(BEARER.length).trim();
}

function allowPolicy(user, methodArn) {
  return {
    principalId: String(user.id),
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: methodArn }],
    },
    context: { userId: String(user.id), role: user.role },
  };
}

export async function checkGatewayToken(authorizationHeader, methodArn) {
  const token = tokenFromHeader(authorizationHeader);
  if (token === '') {
    throw new Error('Unauthorized');
  }
  const found = await findSessionByToken(token);
  if (found === null) {
    throw new Error('Unauthorized');
  }
  return allowPolicy(found.user, methodArn);
}
