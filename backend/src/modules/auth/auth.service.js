import crypto from 'node:crypto';
import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { hashPassword, verifyPassword } from './password.js';
import { sendEmail } from '../../shared/email.js';

const SESSION_HOURS = 8;
const CODE_MINUTES = 15;
const MAX_CODE_TRIES = 5;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
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

const WELCOME_TEXT = {
  STUDENT: 'You can now browse approved events, save them, register and get reminders.',
  ORGANIZER: 'You can now create events. An admin reviews each event before students see it.',
};

async function saveUser(input, passwordHash) {
  try {
    return await db().user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: passwordHash,
        role: input.role,
        emailVerified: false,
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
    WELCOME_TEXT[user.role] + '\n\n' +
    'Campus Events';
  await sendEmail(user.email, 'Welcome to Campus Events', text);
}

function newVerificationCode() {
  const code = String(crypto.randomInt(100000, 1000000));
  return {
    code: code,
    hash: hashToken(code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
  };
}

const CODE_EMAILS = {
  verify: { subject: 'Your Campus Events code: ', use: 'Type it to check your email address.' },
  reset: { subject: 'Reset your Campus Events password: ', use: 'Type it with your new password to reset your password.' },
};

async function sendCode(user, purpose) {
  const fresh = newVerificationCode();
  await db().user.update({
    where: { id: user.id },
    data: { verifyCodeHash: fresh.hash, verifyCodeExpiresAt: fresh.expiresAt, verifyTries: 0 },
  });
  const text =
    'Hi ' + user.name + ',\n\n' +
    'Your Campus Events code is ' + fresh.code + '.\n' +
    CODE_EMAILS[purpose].use + '\n' +
    'It works for ' + CODE_MINUTES + ' minutes.\n\n' +
    'If you did not ask for this code, you can ignore this email.\n\n' +
    'Campus Events';
  await sendEmail(user.email, CODE_EMAILS[purpose].subject + fresh.code, text);
}

async function sendVerificationCode(user) {
  await sendCode(user, 'verify');
}

export async function registerUser(input) {
  const passwordHash = await hashPassword(input.password);
  const user = await saveUser(input, passwordHash);
  await sendVerificationCode(user);
  return { user: toPublicUser(user), needsVerification: true };
}

function checkCode(user, code) {
  if (user === null || user.verifyCodeHash === null) {
    throw new AppError(400, 'This code is not valid. Ask for a new code.');
  }
  if (user.verifyTries >= MAX_CODE_TRIES) {
    throw new AppError(400, 'Too many wrong codes. Ask for a new code.');
  }
  if (user.verifyCodeExpiresAt < new Date()) {
    throw new AppError(400, 'This code has expired. Ask for a new code.');
  }
  return hashToken(code) === user.verifyCodeHash;
}

export async function verifyEmail(input) {
  const user = await db().user.findUnique({ where: { email: input.email } });
  if (!checkCode(user, input.code)) {
    await db().user.update({ where: { id: user.id }, data: { verifyTries: { increment: 1 } } });
    throw new AppError(400, 'Wrong code. Check the email and try again.');
  }
  const firstLogin = (await db().session.count({ where: { userId: user.id } })) === 0;
  const verifiedUser = await db().user.update({
    where: { id: user.id },
    data: { emailVerified: true, verifyCodeHash: null, verifyCodeExpiresAt: null, verifyTries: 0 },
  });
  if (firstLogin) {
    await sendWelcomeEmail(verifiedUser);
  }
  const token = await createSession(user.id);
  return { token: token, user: toPublicUser(verifiedUser) };
}

export async function resendCode(input) {
  const user = await db().user.findUnique({ where: { email: input.email } });
  if (user !== null && !user.emailVerified) {
    await sendVerificationCode(user);
  }
  return { message: 'If this email needs a code, a new code was sent.' };
}

export async function forgotPassword(input) {
  const user = await db().user.findUnique({ where: { email: input.email } });
  if (user !== null) {
    await sendCode(user, 'reset');
  }
  return { message: 'If an account uses this email, a code was sent to it.' };
}

export async function resetPassword(input) {
  const user = await db().user.findUnique({ where: { email: input.email } });
  if (!checkCode(user, input.code)) {
    await db().user.update({ where: { id: user.id }, data: { verifyTries: { increment: 1 } } });
    throw new AppError(400, 'Wrong code. Check the email and try again.');
  }
  await db().user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      emailVerified: true,
      verifyCodeHash: null,
      verifyCodeExpiresAt: null,
      verifyTries: 0,
    },
  });
  await db().session.deleteMany({ where: { userId: user.id } });
  return { message: 'Your password is changed. You can log in now.' };
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
  if (input.role && input.role !== user.role) {
    throw new AppError(401, 'This account is not ' + roleWithArticle(input.role) + ' account');
  }
  if (!user.emailVerified) {
    throw new AppError(403, 'Please verify your email first', { needsVerification: true, email: user.email });
  }
  const token = await createSession(user.id);
  return { token: token, user: toPublicUser(user) };
}

function roleWithArticle(role) {
  if (role === 'ADMIN' || role === 'ORGANIZER') {
    return 'an ' + role.toLowerCase();
  }
  return 'a ' + role.toLowerCase();
}

async function checkCurrentPassword(user, changes) {
  const emailChanges = changes.email !== undefined && changes.email !== user.email;
  if (!emailChanges && changes.newPassword === undefined) {
    return;
  }
  if (!changes.currentPassword) {
    throw new AppError(400, 'Type your current password to change your email or password');
  }
  const passwordIsCorrect = await verifyPassword(changes.currentPassword, user.passwordHash);
  if (!passwordIsCorrect) {
    throw new AppError(400, 'Your current password is not correct');
  }
}

async function buildProfileChanges(user, changes) {
  const data = {};
  if (changes.name !== undefined) {
    data.name = changes.name;
  }
  if (changes.email !== undefined && changes.email !== user.email) {
    data.email = changes.email;
    data.emailVerified = false;
  }
  if (changes.newPassword !== undefined) {
    data.passwordHash = await hashPassword(changes.newPassword);
  }
  return data;
}

async function saveProfile(userId, data) {
  try {
    return await db().user.update({ where: { id: userId }, data: data });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'This email is already registered');
    }
    throw error;
  }
}

export async function updateProfile(userId, currentSessionId, changes) {
  const user = await db().user.findUnique({ where: { id: userId } });
  await checkCurrentPassword(user, changes);
  const updatedUser = await saveProfile(userId, await buildProfileChanges(user, changes));
  if (changes.newPassword !== undefined) {
    await db().session.deleteMany({ where: { userId: userId, id: { not: currentSessionId } } });
  }
  if (updatedUser.email !== user.email) {
    await sendVerificationCode(updatedUser);
  }
  return toPublicUser(updatedUser);
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
