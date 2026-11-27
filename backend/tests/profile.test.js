import 'dotenv/config';
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
const EMAIL_ENDING = '@profile-test.campus';
const PASSWORD = 'password123';

let server;
let baseUrl;
let renamedUserToken = '';

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

async function signUp(name, role) {
  const body = { name: name, email: emailFor(name), password: PASSWORD };
  if (role) {
    body.role = role;
  }
  const response = await callApi('POST', '/api/auth/register', body);
  if (response.status === 201) {
    await db().user.update({ where: { email: body.email }, data: { emailVerified: true } });
  }
  return response;
}

async function logIn(email, password, role) {
  const response = await callApi('POST', '/api/auth/login', { email: email, password: password, role: role });
  return response;
}

before(async function () {
  server = await startServer(makeApp([{ path: '/api/auth', router: authRouter }]));
  baseUrl = 'http://localhost:' + server.address().port;
});

after(async function () {
  await db().user.deleteMany({ where: { email: { endsWith: EMAIL_ENDING } } });
  server.close();
});

test('sign-up can create an organizer', async function () {
  const response = await signUp('new-organizer', 'ORGANIZER');
  assert.equal(response.status, 201);
  assert.equal(response.data.user.role, 'ORGANIZER');
});

test('login with the wrong role gives 401, with the right role it works', async function () {
  await signUp('role-student', 'STUDENT');
  const wrongRole = await logIn(emailFor('role-student'), PASSWORD, 'ORGANIZER');
  assert.equal(wrongRole.status, 401);
  assert.equal(wrongRole.data.error, 'This account is not an organizer account');
  const rightRole = await logIn(emailFor('role-student'), PASSWORD, 'STUDENT');
  assert.equal(rightRole.status, 200);
  assert.equal(rightRole.data.user.role, 'STUDENT');
});

test('a wrong password still says wrong email or password, even with a role', async function () {
  const response = await logIn(emailFor('role-student'), 'wrong-password', 'ADMIN');
  assert.equal(response.status, 401);
  assert.equal(response.data.error, 'Wrong email or password');
});

test('the name can be changed without the current password', async function () {
  await signUp('rename-me');
  const login = await logIn(emailFor('rename-me'), PASSWORD);
  renamedUserToken = login.data.token;
  const response = await callApi('PATCH', '/api/auth/me', { name: 'New Name' }, renamedUserToken);
  assert.equal(response.status, 200);
  assert.equal(response.data.user.name, 'New Name');
  const me = await callApi('GET', '/api/auth/me', undefined, login.data.token);
  assert.equal(me.data.user.name, 'New Name');
});

test('changing the email needs the right current password', async function () {
  await signUp('move-email');
  const login = await logIn(emailFor('move-email'), PASSWORD);
  const token = login.data.token;
  const newEmail = emailFor('moved-email');
  const noPassword = await callApi('PATCH', '/api/auth/me', { email: newEmail }, token);
  assert.equal(noPassword.status, 400);
  const wrongPassword = await callApi('PATCH', '/api/auth/me', { email: newEmail, currentPassword: 'wrong-password' }, token);
  assert.equal(wrongPassword.status, 400);
  assert.equal(wrongPassword.data.error, 'Your current password is not correct');
  const rightPassword = await callApi('PATCH', '/api/auth/me', { email: newEmail, currentPassword: PASSWORD }, token);
  assert.equal(rightPassword.status, 200);
  assert.equal(rightPassword.data.user.email, newEmail);
});

test('an email that another account uses gives 409', async function () {
  await signUp('taken-one');
  await signUp('taken-two');
  const login = await logIn(emailFor('taken-two'), PASSWORD);
  const response = await callApi('PATCH', '/api/auth/me', { email: emailFor('taken-one'), currentPassword: PASSWORD }, login.data.token);
  assert.equal(response.status, 409);
});

test('a new password works, the old one stops and other logins are ended', async function () {
  await signUp('new-password');
  const email = emailFor('new-password');
  const otherDevice = await logIn(email, PASSWORD);
  const thisDevice = await logIn(email, PASSWORD);
  const response = await callApi('PATCH', '/api/auth/me', { newPassword: 'brand-new-pass', currentPassword: PASSWORD }, thisDevice.data.token);
  assert.equal(response.status, 200);
  assert.equal(response.data.user.passwordHash, undefined);
  const otherStillIn = await callApi('GET', '/api/auth/me', undefined, otherDevice.data.token);
  assert.equal(otherStillIn.status, 401);
  const thisStillIn = await callApi('GET', '/api/auth/me', undefined, thisDevice.data.token);
  assert.equal(thisStillIn.status, 200);
  assert.equal((await logIn(email, PASSWORD)).status, 401);
  assert.equal((await logIn(email, 'brand-new-pass')).status, 200);
});

test('a profile change needs a login and at least one change', async function () {
  const noLogin = await callApi('PATCH', '/api/auth/me', { name: 'Nobody' });
  assert.equal(noLogin.status, 401);
  const nothing = await callApi('PATCH', '/api/auth/me', {}, renamedUserToken);
  assert.equal(nothing.status, 400);
  const badName = await callApi('PATCH', '/api/auth/me', { name: '<b>x</b>' }, renamedUserToken);
  assert.equal(badName.status, 400);
});
