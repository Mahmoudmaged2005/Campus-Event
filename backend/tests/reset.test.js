import 'dotenv/config';
import crypto from 'node:crypto';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from '../src/app.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { db } from '../src/db/client.js';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is missing in backend/.env');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const RUN = String(Date.now());
const EMAIL_ENDING = '@reset-test.campus';
const OLD_PASSWORD = 'old-password-1';
const NEW_PASSWORD = 'new-password-2';
const KNOWN_CODE = '654321';

let server;
let baseUrl;

function startServer(app) {
  return new Promise(function (resolve) {
    const startedServer = app.listen(0, function () {
      resolve(startedServer);
    });
  });
}

function emailFor(name) {
  return name + '-' + RUN + EMAIL_ENDING;
}

function hashOf(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
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

async function makeUser(name) {
  const passwordHash = await hashPassword(OLD_PASSWORD);
  return db().user.create({ data: { name: name, email: emailFor(name), role: 'STUDENT', passwordHash: passwordHash } });
}

async function useKnownCode(email, minutesLeft) {
  await db().user.update({
    where: { email: email },
    data: { verifyCodeHash: hashOf(KNOWN_CODE), verifyCodeExpiresAt: new Date(Date.now() + minutesLeft * 60 * 1000), verifyTries: 0 },
  });
}

before(async function () {
  server = await startServer(makeApp([{ path: '/api/auth', router: authRouter }]));
  baseUrl = 'http://localhost:' + server.address().port;
});

after(async function () {
  await db().user.deleteMany({ where: { email: { endsWith: EMAIL_ENDING } } });
  server.close();
});

test('forgot password gives the same answer for known and unknown emails and makes a code', async function () {
  await makeUser('forgetful');
  const known = await callApi('POST', '/api/auth/forgot-password', { email: emailFor('forgetful') });
  const unknown = await callApi('POST', '/api/auth/forgot-password', { email: emailFor('nobody-at-all') });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(known.data.message, unknown.data.message);
  const user = await db().user.findUnique({ where: { email: emailFor('forgetful') } });
  assert.match(user.verifyCodeHash, /^[0-9a-f]{64}$/);
});

test('the right code sets the new password and ends every old login', async function () {
  const email = emailFor('forgetful');
  const oldLogin = await callApi('POST', '/api/auth/login', { email: email, password: OLD_PASSWORD });
  assert.equal(oldLogin.status, 200);
  await useKnownCode(email, 10);
  const wrong = await callApi('POST', '/api/auth/reset-password', { email: email, code: '000000', newPassword: NEW_PASSWORD });
  assert.equal(wrong.status, 400);
  const right = await callApi('POST', '/api/auth/reset-password', { email: email, code: KNOWN_CODE, newPassword: NEW_PASSWORD });
  assert.equal(right.status, 200);
  const oldSession = await callApi('GET', '/api/auth/me', undefined, oldLogin.data.token);
  assert.equal(oldSession.status, 401);
  assert.equal((await callApi('POST', '/api/auth/login', { email: email, password: OLD_PASSWORD })).status, 401);
  assert.equal((await callApi('POST', '/api/auth/login', { email: email, password: NEW_PASSWORD })).status, 200);
});

test('an expired code cannot reset the password', async function () {
  await makeUser('too-late');
  await useKnownCode(emailFor('too-late'), -1);
  const response = await callApi('POST', '/api/auth/reset-password', { email: emailFor('too-late'), code: KNOWN_CODE, newPassword: NEW_PASSWORD });
  assert.equal(response.status, 400);
  assert.equal(response.data.error, 'This code has expired. Ask for a new code.');
});

test('a new password that is too short is refused', async function () {
  const response = await callApi('POST', '/api/auth/reset-password', { email: emailFor('too-late'), code: KNOWN_CODE, newPassword: 'short' });
  assert.equal(response.status, 400);
});
