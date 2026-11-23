import { AppError } from '../errors.js';
import { findSessionByToken } from '../../modules/auth/auth.service.js';

function readBearerToken(req) {
  const header = req.get('authorization');
  if (!header) {
    return null;
  }
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  return parts[1];
}

export async function requireAuth(req, res, next) {
  const token = readBearerToken(req);
  if (token === null) {
    throw new AppError(401, 'Please log in first');
  }
  const session = await findSessionByToken(token);
  if (session === null) {
    throw new AppError(401, 'Your session has ended, please log in again');
  }
  req.user = session.user;
  req.sessionId = session.sessionId;
  next();
}

export function requireRole(...allowedRoles) {
  return function checkRole(req, res, next) {
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(403, 'You are not allowed to do this');
    }
    next();
  };
}
