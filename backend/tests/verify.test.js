import 'dotenv/config';
import crypto from 'node:crypto';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from '../src/app.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { db } from '../src/db/client.js';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is missing in backend/.env');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const RUN = String(Date.now());
const EMAIL_ENDING = '@verify-test.campus';
const PASSWORD = 'password123';
const KNOWN_CODE = '123456';

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

async function signUp(name) {
  return callApi('POST', '/api/auth/register', { name: name, email: emailFor(name), password: PASSWORD });
}

async function useKnownCode(email, minutesLeft) {
  await db().user.update({
    where: { email: email },
    data: { verifyCodeHash: hashOf(KNOWN_CODE), verifyCodeExpiresAt: new Date(Date.now() + minutesLeft * 60 * 1000) },
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

test('a new account is not verified, gets a code and cannot log in yet', async function () {
  const response = await signUp('new-person');
  assert.equal(response.status, 201);
  assert.equal(response.data.needsVerification, true);
  assert.equal(response.data.user.emailVerified, false);
  assert.equal(response.data.token, undefined);
  const user = await db().user.findUnique({ where: { email: emailFor('new-person') } });
  assert.match(user.verifyCodeHash, /^[0-9a-f]{64}$/);
  const login = await callApi('POST', '/api/auth/login', { email: emailFor('new-person'), password: PASSWORD });
  assert.equal(login.status, 403);
  assert.equal(login.data.needsVerification, true);
});

test('the right code verifies the email and logs the person in', async function () {
  await signUp('right-code');
  await useKnownCode(emailFor('right-code'), 10);
  const wrong = await callApi('POST', '/api/auth/verify-email', { email: emailFor('right-code'), code: '000000' });
  assert.equal(wrong.status, 400);
  const right = await callApi('POST', '/api/auth/verify-email', { email: emailFor('right-code'), code: KNOWN_CODE });
  assert.equal(right.status, 200);
  assert.equal(typeof right.data.token, 'string');
  assert.equal(right.data.user.emailVerified, true);
  const me = await callApi('GET', '/api/auth/me', undefined, right.data.token);
  assert.equal(me.status, 200);
  const user = await db().user.findUnique({ where: { email: emailFor('right-code') } });
  assert.equal(user.verifyCodeHash, null);
});

test('an expired code is refused', async function () {
  await signUp('old-code');
  await useKnownCode(emailFor('old-code'), -1);
  const response = await callApi('POST', '/api/auth/verify-email', { email: emailFor('old-code'), code: KNOWN_CODE });
  assert.equal(response.status, 400);
  assert.equal(response.data.error, 'This code has expired. Ask for a new code.');
});

test('after 5 wrong codes even the right code is refused', async function () {
  await signUp('guesser');
  await useKnownCode(emailFor('guesser'), 10);
  await db().user.update({ where: { email: emailFor('guesser') }, data: { verifyTries: 5 } });
  const response = await callApi('POST', '/api/auth/verify-email', { email: emailFor('guesser'), code: KNOWN_CODE });
  assert.equal(response.status, 400);
  assert.equal(response.data.error, 'Too many wrong codes. Ask for a new code.');
});

test('a code must be 6 digits', async function () {
  const response = await callApi('POST', '/api/auth/verify-email', { email: emailFor('guesser'), code: '12ab' });
  assert.equal(response.status, 400);
});

test('resend gives a new code and the same answer for unknown emails', async function () {
  const before = await db().user.findUnique({ where: { email: emailFor('new-person') } });
  const known = await callApi('POST', '/api/auth/resend-code', { email: emailFor('new-person') });
  const unknown = await callApi('POST', '/api/auth/resend-code', { email: emailFor('nobody-here') });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(known.data.message, unknown.data.message);
  const afterResend = await db().user.findUnique({ where: { email: emailFor('new-person') } });
  assert.notEqual(afterResend.verifyCodeHash, before.verifyCodeHash);
});
