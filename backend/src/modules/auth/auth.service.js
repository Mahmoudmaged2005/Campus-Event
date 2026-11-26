import crypto from 'node:crypto';
import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { hashPassword, verifyPassword } from './password.js';
import { sendEmail } from '../../shared/email.js';

const SESSION_HOURS = 8;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await db().session.create({
    data: { tokenHash: hashToken(token), userId: userId, expiresAt: expiresAt },
  });
  return token;
}

async function saveStudent(input, passwordHash) {
  try {
    return await db().user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: passwordHash,
        role: 'STUDENT',
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'This email is already registered');
    }
    throw error;
  }
}

async function sendWelcomeEmail(user) {
  const text =
    'Hi ' + user.name + ',\n\n' +
    'Welcome to Campus Events! Your account is ready.\n' +
    'You can now browse approved events, save them, register and get reminders.\n\n' +
    'Campus Events';
  await sendEmail(user.email, 'Welcome to Campus Events', text);
}

export async function registerStudent(input) {
  const passwordHash = await hashPassword(input.password);
  const user = await saveStudent(input, passwordHash);
  await sendWelcomeEmail(user);
  return toPublicUser(user);
}

export async function logIn(input) {
  const user = await db().user.findUnique({ where: { email: input.email } });
  if (user === null) {
    throw new AppError(401, 'Wrong email or password');
  }
  const passwordIsCorrect = await verifyPassword(input.password, user.passwordHash);
  if (!passwordIsCorrect) {
    throw new AppError(401, 'Wrong email or password');
  }
  const token = await createSession(user.id);
  return { token: token, user: toPublicUser(user) };
}

export async function findSessionByToken(token) {
  const session = await db().session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (session === null) {
    return null;
  }
  if (session.expiresAt < new Date()) {
    await db().session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return { sessionId: session.id, user: toPublicUser(session.user) };
}

export async function logOut(sessionId) {
  await db().session.deleteMany({ where: { id: sessionId } });
}
