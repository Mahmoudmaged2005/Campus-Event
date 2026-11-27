import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Router } from 'express';
import { makeApp } from '../src/app.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { requireAuth, requireRole } from '../src/shared/middleware/auth.js';
import { db } from '../src/db/client.js';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is missing in backend/.env');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const EMAIL_ENDING = '@auth-test.campus';
const studentEmail = 'student-' + Date.now() + EMAIL_ENDING;
const studentPassword = 'password123';

let server;
let baseUrl;
let studentToken;

function makeAdminOnlyRouter() {
  const router = Router();
  router.get('/', requireAuth, requireRole('ADMIN'), function (req, res) {
    res.json({ ok: true });
  });
  return router;
}

function startServer(app) {
  return new Promise(function (resolve) {
    const startedServer = app.listen(0, function () {
      resolve(startedServer);
    });
  });
}

async function callApi(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }
  const options = { method: method, headers: headers };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(baseUrl + path, options);
  const text = await response.text();
  let data = null;
  if (text !== '') {
    data = JSON.parse(text);
  }
  return { status: response.status, data: data };
}

async function logInStudent() {
  const response = await callApi('POST', '/api/auth/login', {
    email: studentEmail,
    password: studentPassword,
  });
  return response.data.token;
}

before(async function () {
  const app = makeApp([
    { path: '/api/auth', router: authRouter },
    { path: '/api/admin-only', router: makeAdminOnlyRouter() },
  ]);
  server = await startServer(app);
  baseUrl = 'http://localhost:' + server.address().port;
});

after(async function () {
  await db().user.deleteMany({ where: { email: { endsWith: EMAIL_ENDING } } });
  await db().$disconnect();
  server.close();
});

test('register refuses the ADMIN role and makes a Student when no role is sent', async function () {
  const adminTry = await callApi('POST', '/api/auth/register', {
    name: 'Want Admin',
    email: 'want-admin' + EMAIL_ENDING,
    password: studentPassword,
    role: 'ADMIN',
  });
  assert.equal(adminTry.status, 400);
  const response = await callApi('POST', '/api/auth/register', {
    name: 'Test Student',
    email: studentEmail,
    password: studentPassword,
  });
  assert.equal(response.status, 201);
  assert.equal(response.data.needsVerification, true);
  await db().user.update({ where: { email: studentEmail }, data: { emailVerified: true } });
  assert.equal(response.data.user.role, 'STUDENT');
  assert.equal(response.data.user.email, studentEmail);
  assert.equal(response.data.user.passwordHash, undefined);
});

test('register stores a salted hash, not the password', async function () {
  const user = await db().user.findUnique({ where: { email: studentEmail } });
  assert.notEqual(user.passwordHash, studentPassword);
  assert.match(user.passwordHash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});

test('register with an email that is already used gives 409', async function () {
  const response = await callApi('POST', '/api/auth/register', {
    name: 'Copy Student',
    email: studentEmail.toUpperCase(),
    password: studentPassword,
  });
  assert.equal(response.status, 409);
  assert.equal(response.data.error, 'This email is already registered');
});

test('register with bad input gives 400', async function () {
  const badBodies = [
    { name: '<b>Bad</b>', email: 'bad1' + EMAIL_ENDING, password: studentPassword },
    { name: 'Short Password', email: 'bad2' + EMAIL_ENDING, password: '123' },
    { name: 'Bad Email', email: 'not-an-email', password: studentPassword },
    { email: 'bad3' + EMAIL_ENDING, password: studentPassword },
  ];
  for (const badBody of badBodies) {
    const response = await callApi('POST', '/api/auth/register', badBody);
    assert.equal(response.status, 400);
    assert.equal(typeof response.data.error, 'string');
  }
});

test('register without a body gives 400', async function () {
  const response = await callApi('POST', '/api/auth/register');
  assert.equal(response.status, 400);
});

test('login with a wrong password or unknown email gives 401', async function () {
  const wrongPassword = await callApi('POST', '/api/auth/login', {
    email: studentEmail,
    password: 'wrong-password',
  });
  const unknownEmail = await callApi('POST', '/api/auth/login', {
    email: 'nobody' + EMAIL_ENDING,
    password: studentPassword,
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.data.error, unknownEmail.data.error);
});

test('login returns a token and the user', async function () {
  const response = await callApi('POST', '/api/auth/login', {
    email: studentEmail,
    password: studentPassword,
  });
  assert.equal(response.status, 200);
  assert.match(response.data.token, /^[0-9a-f]{64}$/);
  assert.equal(response.data.user.email, studentEmail);
  studentToken = response.data.token;
});

test('only the SHA-256 hash of the token is stored', async function () {
  const tokenHash = crypto.createHash('sha256').update(studentToken).digest('hex');
  const sessionByHash = await db().session.findUnique({ where: { tokenHash: tokenHash } });
  const sessionByToken = await db().session.findUnique({ where: { tokenHash: studentToken } });
  assert.notEqual(sessionByHash, null);
  assert.equal(sessionByToken, null);
});

test('the session expires after 8 hours', async function () {
  const tokenHash = crypto.createHash('sha256').update(studentToken).digest('hex');
  const session = await db().session.findUnique({ where: { tokenHash: tokenHash } });
  const hoursLeft = (session.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000);
  assert.ok(hoursLeft > 7.9 && hoursLeft <= 8);
});

test('me returns the logged in user', async function () {
  const response = await callApi('GET', '/api/auth/me', undefined, studentToken);
  assert.equal(response.status, 200);
  assert.equal(response.data.user.email, studentEmail);
  assert.equal(response.data.user.role, 'STUDENT');
});

test('me without a valid token gives 401', async function () {
  const noToken = await callApi('GET', '/api/auth/me');
  const fakeToken = await callApi('GET', '/api/auth/me', undefined, 'abc123');
  assert.equal(noToken.status, 401);
  assert.equal(fakeToken.status, 401);
});

test('a route for another role gives 403', async function () {
  const response = await callApi('GET', '/api/admin-only', undefined, studentToken);
  assert.equal(response.status, 403);
});

test('a route for the right role is allowed', async function () {
  await db().user.update({ where: { email: studentEmail }, data: { role: 'ADMIN' } });
  const response = await callApi('GET', '/api/admin-only', undefined, studentToken);
  await db().user.update({ where: { email: studentEmail }, data: { role: 'STUDENT' } });
  assert.equal(response.status, 200);
});

test('an expired session gives 401 and is deleted', async function () {
  const token = await logInStudent();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db().session.update({
    where: { tokenHash: tokenHash },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const response = await callApi('GET', '/api/auth/me', undefined, token);
  const session = await db().session.findUnique({ where: { tokenHash: tokenHash } });
  assert.equal(response.status, 401);
  assert.equal(session, null);
});

test('logout ends the session', async function () {
  const logout = await callApi('POST', '/api/auth/logout', undefined, studentToken);
  const meAfterLogout = await callApi('GET', '/api/auth/me', undefined, studentToken);
  assert.equal(logout.status, 204);
  assert.equal(meAfterLogout.status, 401);
});

test('more than 10 logins in a minute gives 429', async function () {
  const statuses = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    const response = await callApi('POST', '/api/auth/login', {
      email: 'nobody' + EMAIL_ENDING,
      password: 'wrong-password',
    });
    statuses.push(response.status);
  }
  assert.equal(statuses[statuses.length - 1], 429);
  assert.ok(statuses.includes(401));
});
