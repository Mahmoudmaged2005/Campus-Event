import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from '../src/app.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { adminRouter } from '../src/modules/admin/admin.routes.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { getTrustScore } from '../src/modules/admin/trust.service.js';
import { lifecycleHandler } from '../src/modules/admin/lambda.js';
import { db } from '../src/db/client.js';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is missing in backend/.env');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const RUN = String(Date.now());
const EMAIL_ENDING = '@admin-test.campus';
const CATEGORY_ENDING = ' ' + RUN;

let server;
let baseUrl;
let categoryId;
const users = {};

function startServer(app) {
  return new Promise(function (resolve) {
    const startedServer = app.listen(0, function () {
      resolve(startedServer);
    });
  });
}

async function callApi(method, path, body, user) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) {
    headers.Authorization = 'Bearer ' + user.token;
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

async function makeUser(name, role) {
  const email = name + '-' + RUN + EMAIL_ENDING;
  const passwordHash = await hashPassword('password123');
  const user = await db().user.create({ data: { name: name, email: email, role: role, passwordHash: passwordHash } });
  const login = await callApi('POST', '/api/auth/login', { email: email, password: 'password123' });
  return { id: user.id, token: login.data.token };
}

async function makeEvent(organizer, title, status, endsAt) {
  const startsAt = new Date(endsAt.getTime() - 60 * 60 * 1000);
  return db().event.create({
    data: {
      title: title,
      description: 'Admin test event',
      location: 'Admin Test Room ' + RUN,
      startsAt: startsAt,
      endsAt: endsAt,
      status: status,
      organizerId: organizer.id,
      categoryId: categoryId,
    },
  });
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function makeFlag(event, reporter, reason) {
  return db().flag.create({ data: { eventId: event.id, reporterId: reporter.id, reason: reason } });
}

async function findEventStatus(eventId) {
  const event = await db().event.findUnique({ where: { id: eventId } });
  return event.status;
}

async function findAuditRow(action, entityType, entityId) {
  return db().auditLog.findFirst({ where: { action: action, entityType: entityType, entityId: entityId } });
}

before(async function () {
  const app = makeApp([
    { path: '/api/auth', router: authRouter },
    { path: '/api/admin', router: adminRouter },
  ]);
  server = await startServer(app);
  baseUrl = 'http://localhost:' + server.address().port;
  categoryId = (await db().category.findFirst({ where: { isActive: true } })).id;
  users.admin = await makeUser('admin', 'ADMIN');
  users.organizer = await makeUser('organizer', 'ORGANIZER');
  users.trustOrganizer = await makeUser('trust-organizer', 'ORGANIZER');
  users.student = await makeUser('student', 'STUDENT');
});

after(async function () {
  const testUsers = await db().user.findMany({ where: { email: { endsWith: EMAIL_ENDING } }, select: { id: true } });
  const userIds = [];
  for (const testUser of testUsers) {
    userIds.push(testUser.id);
  }
  await db().auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await db().event.deleteMany({ where: { organizerId: { in: userIds } } });
  await db().category.deleteMany({ where: { name: { endsWith: CATEGORY_ENDING } } });
  await db().user.deleteMany({ where: { id: { in: userIds } } });
  await db().$disconnect();
  server.close();
});

test('admin routes need a login (401) and the ADMIN role (403)', async function () {
  const paths = ['/api/admin/review-queue', '/api/admin/categories', '/api/admin/flags'];
  for (const path of paths) {
    const noLogin = await callApi('GET', path);
    assert.equal(noLogin.status, 401);
    const asOrganizer = await callApi('GET', path, undefined, users.organizer);
    assert.equal(asOrganizer.status, 403);
    const asStudent = await callApi('GET', path, undefined, users.student);
    assert.equal(asStudent.status, 403);
  }
});

test('review queue lists pending events oldest first with organizer and trust, never the password', async function () {
  const first = await makeEvent(users.organizer, 'Queue first', 'PENDING', daysFromNow(10));
  const second = await makeEvent(users.organizer, 'Queue second', 'PENDING', daysFromNow(5));
  const approved = await makeEvent(users.organizer, 'Queue approved', 'APPROVED', daysFromNow(5));

  const response = await callApi('GET', '/api/admin/review-queue', undefined, users.admin);
  assert.equal(response.status, 200);

  const ids = [];
  for (const event of response.data.events) {
    ids.push(event.id);
  }
  assert.ok(ids.indexOf(first.id) < ids.indexOf(second.id));
  assert.equal(ids.includes(approved.id), false);

  const queuedEvent = response.data.events[ids.indexOf(first.id)];
  assert.equal(queuedEvent.organizer.id, users.organizer.id);
  assert.equal(queuedEvent.organizer.passwordHash, undefined);
  assert.equal(typeof queuedEvent.organizerTrust.level, 'string');
});

test('approve turns a pending event APPROVED and writes an audit row', async function () {
  const event = await makeEvent(users.organizer, 'To approve', 'PENDING', daysFromNow(7));
  const response = await callApi('POST', '/api/admin/events/' + event.id + '/approve', undefined, users.admin);
  assert.equal(response.status, 200);
  assert.equal(response.data.event.status, 'APPROVED');
  assert.equal(response.data.event.rejectionReason, null);

  const auditRow = await findAuditRow('event.approved', 'Event', event.id);
  assert.equal(auditRow.actorId, users.admin.id);
});

test('reject saves the reason and writes an audit row', async function () {
  const event = await makeEvent(users.organizer, 'To reject', 'PENDING', daysFromNow(7));
  const response = await callApi(
    'POST',
    '/api/admin/events/' + event.id + '/reject',
    { reason: 'Please add the room number' },
    users.admin,
  );
  assert.equal(response.status, 200);
  assert.equal(response.data.event.status, 'REJECTED');
  assert.equal(response.data.event.rejectionReason, 'Please add the room number');

  const auditRow = await findAuditRow('event.rejected', 'Event', event.id);
  assert.equal(auditRow.details.reason, 'Please add the room number');
});

test('reject with a bad reason gives 400', async function () {
  const event = await makeEvent(users.organizer, 'Bad reason', 'PENDING', daysFromNow(7));
  const badBodies = [{}, { reason: 'no' }, { reason: '<script>bad</script>' }, { reason: 'x'.repeat(501) }];
  for (const badBody of badBodies) {
    const response = await callApi('POST', '/api/admin/events/' + event.id + '/reject', badBody, users.admin);
    assert.equal(response.status, 400);
  }
  assert.equal(await findEventStatus(event.id), 'PENDING');
});

test('only pending events can be reviewed (409), missing gives 404, bad id gives 400', async function () {
  const approved = await makeEvent(users.organizer, 'Already approved', 'APPROVED', daysFromNow(7));
  const again = await callApi('POST', '/api/admin/events/' + approved.id + '/approve', undefined, users.admin);
  assert.equal(again.status, 409);

  const missing = await callApi('POST', '/api/admin/events/999999999/approve', undefined, users.admin);
  assert.equal(missing.status, 404);

  const badId = await callApi('POST', '/api/admin/events/abc/approve', undefined, users.admin);
  assert.equal(badId.status, 400);
});

test('categories: add, refuse duplicates and bad names, rename and turn off', async function () {
  const name = 'Hackathon' + CATEGORY_ENDING;
  const created = await callApi('POST', '/api/admin/categories', { name: name }, users.admin);
  assert.equal(created.status, 201);
  assert.equal(created.data.category.isActive, true);
  const newCategoryId = created.data.category.id;

  const duplicate = await callApi('POST', '/api/admin/categories', { name: name.toUpperCase() }, users.admin);
  assert.equal(duplicate.status, 409);

  const badName = await callApi('POST', '/api/admin/categories', { name: '<b>' }, users.admin);
  assert.equal(badName.status, 400);

  const emptyChange = await callApi('PATCH', '/api/admin/categories/' + newCategoryId, {}, users.admin);
  assert.equal(emptyChange.status, 400);

  const newName = 'Coding Night' + CATEGORY_ENDING;
  const changed = await callApi(
    'PATCH',
    '/api/admin/categories/' + newCategoryId,
    { name: newName, isActive: false },
    users.admin,
  );
  assert.equal(changed.status, 200);
  assert.equal(changed.data.category.name, newName);
  assert.equal(changed.data.category.isActive, false);

  const missing = await callApi('PATCH', '/api/admin/categories/999999999', { isActive: true }, users.admin);
  assert.equal(missing.status, 404);

  const auditRow = await findAuditRow('category.updated', 'Category', newCategoryId);
  assert.equal(auditRow.details.oldName, name);
  assert.equal(auditRow.details.newIsActive, false);
});

test('category list includes inactive categories and event counts', async function () {
  const response = await callApi('GET', '/api/admin/categories', undefined, users.admin);
  assert.equal(response.status, 200);
  let foundInactive = false;
  for (const category of response.data.categories) {
    assert.equal(typeof category._count.events, 'number');
    if (category.name.endsWith(CATEGORY_ENDING) && category.isActive === false) {
      foundInactive = true;
    }
  }
  assert.equal(foundInactive, true);
});

test('dismiss closes only that flag and keeps the event', async function () {
  const event = await makeEvent(users.organizer, 'Flag dismiss', 'APPROVED', daysFromNow(7));
  const flag = await makeFlag(event, users.student, 'Looks wrong');

  const list = await callApi('GET', '/api/admin/flags', undefined, users.admin);
  assert.equal(list.status, 200);
  let found = false;
  for (const listedFlag of list.data.flags) {
    if (listedFlag.id === flag.id) {
      found = true;
      assert.equal(listedFlag.event.title, 'Flag dismiss');
    }
  }
  assert.equal(found, true);

  const response = await callApi('POST', '/api/admin/flags/' + flag.id + '/dismiss', undefined, users.admin);
  assert.equal(response.status, 200);
  assert.equal(response.data.flag.status, 'DISMISSED');
  assert.equal(await findEventStatus(event.id), 'APPROVED');

  const again = await callApi('POST', '/api/admin/flags/' + flag.id + '/resolve', undefined, users.admin);
  assert.equal(again.status, 409);
});

test('resolve cancels an approved event and closes all its open flags', async function () {
  const event = await makeEvent(users.organizer, 'Flag resolve', 'APPROVED', daysFromNow(7));
  const firstFlag = await makeFlag(event, users.student, 'Wrong place');
  const secondFlag = await makeFlag(event, users.student, 'Wrong time');

  const response = await callApi('POST', '/api/admin/flags/' + firstFlag.id + '/resolve', undefined, users.admin);
  assert.equal(response.status, 200);
  assert.equal(response.data.flag.status, 'RESOLVED');
  assert.equal(await findEventStatus(event.id), 'CANCELLED');

  const otherFlag = await db().flag.findUnique({ where: { id: secondFlag.id } });
  assert.equal(otherFlag.status, 'RESOLVED');

  const auditRow = await findAuditRow('flag.resolved', 'Flag', firstFlag.id);
  assert.equal(auditRow.details.eventCancelled, true);

  const missing = await callApi('POST', '/api/admin/flags/999999999/resolve', undefined, users.admin);
  assert.equal(missing.status, 404);
});

test('trust score: NEW without reviews, then approvals minus 10 per resolved flag', async function () {
  const fresh = await getTrustScore(users.trustOrganizer.id);
  assert.equal(fresh.level, 'NEW');
  assert.equal(fresh.score, null);

  const good = await makeEvent(users.trustOrganizer, 'Trust good', 'PENDING', daysFromNow(9));
  const bad = await makeEvent(users.trustOrganizer, 'Trust bad', 'PENDING', daysFromNow(9));
  await callApi('POST', '/api/admin/events/' + good.id + '/approve', undefined, users.admin);
  await callApi('POST', '/api/admin/events/' + bad.id + '/reject', { reason: 'Missing details' }, users.admin);

  const half = await getTrustScore(users.trustOrganizer.id);
  assert.equal(half.score, 50);
  assert.equal(half.level, 'NORMAL');

  const flag = await makeFlag(good, users.student, 'Not real');
  await callApi('POST', '/api/admin/flags/' + flag.id + '/resolve', undefined, users.admin);

  const lower = await getTrustScore(users.trustOrganizer.id);
  assert.equal(lower.score, 40);
  assert.equal(lower.level, 'LOW');
  assert.equal(lower.resolvedFlagCount, 1);
});

test('life cycle job completes only approved events that have ended', async function () {
  const pastApproved = await makeEvent(users.organizer, 'Past approved', 'APPROVED', daysFromNow(-2));
  const pastPending = await makeEvent(users.organizer, 'Past pending', 'PENDING', daysFromNow(-2));
  const futureApproved = await makeEvent(users.organizer, 'Future approved', 'APPROVED', daysFromNow(3));

  const response = await callApi('POST', '/api/admin/lifecycle/run', undefined, users.admin);
  assert.equal(response.status, 200);
  assert.ok(response.data.completedCount >= 1);

  assert.equal(await findEventStatus(pastApproved.id), 'COMPLETED');
  assert.equal(await findEventStatus(pastPending.id), 'PENDING');
  assert.equal(await findEventStatus(futureApproved.id), 'APPROVED');

  const secondRun = await lifecycleHandler();
  assert.equal(secondRun.completedCount, 0);
});
