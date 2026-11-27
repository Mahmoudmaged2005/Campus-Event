import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from '../src/app.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { adminRouter } from '../src/modules/admin/admin.routes.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { writeAuditLog } from '../src/modules/audit/audit.service.js';
import { db } from '../src/db/client.js';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is missing in backend/.env');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const RUN = String(Date.now());
const EMAIL_ENDING = '@audit-test.campus';
const TEST_ACTION = 'test.auditpage';

let server;
let baseUrl;
let adminToken;
let studentToken;
let adminId;

function startServer(app) {
  return new Promise(function (resolve) {
    const startedServer = app.listen(0, function () {
      resolve(startedServer);
    });
  });
}

async function callApi(path, token) {
  const headers = {};
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }
  const response = await fetch(baseUrl + path, { headers: headers });
  return { status: response.status, data: await response.json() };
}

async function makeUser(name, role) {
  const email = name + '-' + RUN + EMAIL_ENDING;
  const passwordHash = await hashPassword('password123');
  const user = await db().user.create({ data: { name: name, email: email, role: role, passwordHash: passwordHash } });
  const response = await fetch(baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: 'password123' }),
  });
  const login = await response.json();
  return { id: user.id, token: login.token };
}

before(async function () {
  server = await startServer(makeApp([
    { path: '/api/auth', router: authRouter },
    { path: '/api/admin', router: adminRouter },
  ]));
  baseUrl = 'http://localhost:' + server.address().port;
  const admin = await makeUser('audit-admin', 'ADMIN');
  const student = await makeUser('audit-student', 'STUDENT');
  adminToken = admin.token;
  adminId = admin.id;
  studentToken = student.token;
  for (let number = 1; number <= 3; number++) {
    await writeAuditLog(adminId, TEST_ACTION, 'Test', number, { run: RUN, number: number });
  }
});

after(async function () {
  await db().auditLog.deleteMany({ where: { action: TEST_ACTION } });
  await db().user.deleteMany({ where: { email: { endsWith: EMAIL_ENDING } } });
  server.close();
});

test('only admins can read the audit log', async function () {
  assert.equal((await callApi('/api/admin/audit-log')).status, 401);
  assert.equal((await callApi('/api/admin/audit-log', studentToken)).status, 403);
  assert.equal((await callApi('/api/admin/audit-log', adminToken)).status, 200);
});

test('the filter shows one action, newest first, with who did it but no password', async function () {
  const response = await callApi('/api/admin/audit-log?action=' + TEST_ACTION, adminToken);
  assert.equal(response.status, 200);
  assert.equal(response.data.entries.length, 3);
  assert.equal(response.data.entries[0].entityId, 3);
  assert.equal(response.data.entries[2].entityId, 1);
  assert.equal(response.data.entries[0].actor.name, 'audit-admin');
  assert.equal(response.data.entries[0].actor.passwordHash, undefined);
  assert.equal(response.data.entries[0].details.run, RUN);
});

test('load more gives the next older entries', async function () {
  const firstPage = await callApi('/api/admin/audit-log?action=' + TEST_ACTION + '&limit=2', adminToken);
  assert.equal(firstPage.data.entries.length, 2);
  assert.notEqual(firstPage.data.nextBeforeId, null);
  const secondPage = await callApi('/api/admin/audit-log?action=' + TEST_ACTION + '&limit=2&beforeId=' + firstPage.data.nextBeforeId, adminToken);
  assert.equal(secondPage.data.entries.length, 1);
  assert.equal(secondPage.data.entries[0].entityId, 1);
  assert.equal(secondPage.data.nextBeforeId, null);
});

test('a bad filter gives 400', async function () {
  const response = await callApi('/api/admin/audit-log?action=DROP%20TABLE', adminToken);
  assert.equal(response.status, 400);
});
