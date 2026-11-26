import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from '../src/app.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { notificationsRouter } from '../src/modules/notifications/notifications.routes.js';
import { notificationsQueueHandler } from '../src/modules/notifications/lambda.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { db } from '../src/db/client.js';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is missing in backend/.env');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const RUN = String(Date.now());
const EMAIL_ENDING = '@notifications-test.campus';
const ONE_DAY = 24 * 60 * 60 * 1000;

let server;
let baseUrl;
let categoryId;
let eventCount = 0;

function startServer(app) {
  return new Promise(function (resolve) {
    const startedServer = app.listen(0, function () {
      resolve(startedServer);
    });
  });
}

async function callApi(method, path, user) {
  const response = await fetch(baseUrl + path, {
    method: method,
    headers: { Authorization: 'Bearer ' + user.token },
  });
  const data = await response.json();
  return { status: response.status, data: data };
}

async function makeOrganizer(name) {
  const email = name + '-' + RUN + EMAIL_ENDING;
  const passwordHash = await hashPassword('password123');
  const user = await db().user.create({ data: { name: name, email: email, role: 'ORGANIZER', passwordHash: passwordHash } });
  const response = await fetch(baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: 'password123' }),
  });
  const login = await response.json();
  return { id: user.id, token: login.token };
}

async function makeEvent(organizer, title, status, rejectionReason) {
  eventCount = eventCount + 1;
  const startsAt = new Date(Date.now() + (10 + eventCount) * ONE_DAY);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  return db().event.create({
    data: {
      title: title,
      description: 'Notifications test event',
      location: 'Notifications Test Room ' + RUN,
      startsAt: startsAt,
      endsAt: endsAt,
      status: status,
      rejectionReason: rejectionReason,
      organizerId: organizer.id,
      categoryId: categoryId,
    },
  });
}

function queueEventFor(type, eventId, organizerId) {
  const body = JSON.stringify({ type: type, data: { eventId: eventId, organizerId: organizerId } });
  return { Records: [{ body: body }] };
}

async function notificationsOf(organizer) {
  return db().notification.findMany({ where: { userId: organizer.id }, orderBy: { id: 'asc' } });
}

before(async function () {
  const app = makeApp([
    { path: '/api/auth', router: authRouter },
    { path: '/api/notifications', router: notificationsRouter },
  ]);
  server = await startServer(app);
  baseUrl = 'http://localhost:' + server.address().port;
  const category = await db().category.findFirst();
  categoryId = category.id;
});

after(async function () {
  const testUsers = await db().user.findMany({ where: { email: { endsWith: EMAIL_ENDING } }, select: { id: true } });
  const userIds = [];
  for (const testUser of testUsers) {
    userIds.push(testUser.id);
  }
  const testEvents = await db().event.findMany({ where: { organizerId: { in: userIds } }, select: { id: true } });
  const eventIds = [];
  for (const testEvent of testEvents) {
    eventIds.push(testEvent.id);
  }
  await db().auditLog.deleteMany({ where: { action: 'organizer.notified', entityId: { in: eventIds } } });
  await db().event.deleteMany({ where: { id: { in: eventIds } } });
  await db().user.deleteMany({ where: { id: { in: userIds } } });
  server.close();
});

test('an approved event tells its organizer and writes an audit row', async function () {
  const organizer = await makeOrganizer('approved');
  const event = await makeEvent(organizer, 'Robotics Workshop', 'APPROVED', null);

  const result = await notificationsQueueHandler(queueEventFor('event.approved', event.id, organizer.id));
  assert.deepEqual(result, { messageCount: 1, notifiedCount: 1 });

  const notifications = await notificationsOf(organizer);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].message, 'Your event "Robotics Workshop" was approved.');
  assert.equal(notifications[0].isRead, false);
  const auditCount = await db().auditLog.count({ where: { action: 'organizer.notified', entityId: event.id } });
  assert.equal(auditCount, 1);
});

test('a rejected event tells its organizer the reason', async function () {
  const organizer = await makeOrganizer('rejected');
  const event = await makeEvent(organizer, 'Late Night Party', 'REJECTED', 'The hall closes at 22:00');

  await notificationsQueueHandler(queueEventFor('event.rejected', event.id, organizer.id));

  const notifications = await notificationsOf(organizer);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].message, 'Your event "Late Night Party" was rejected: The hall closes at 22:00');
});

test('a very long title and reason still fit in one notification', async function () {
  const organizer = await makeOrganizer('long');
  const event = await makeEvent(organizer, 'T'.repeat(120), 'REJECTED', 'R'.repeat(500));

  await notificationsQueueHandler(queueEventFor('event.rejected', event.id, organizer.id));

  const notifications = await notificationsOf(organizer);
  assert.equal(notifications.length, 1);
  assert.ok(notifications[0].message.length <= 500);
  assert.ok(notifications[0].message.endsWith('R'.repeat(300) + '...'));
});

test('a message is skipped when the event status no longer matches', async function () {
  const organizer = await makeOrganizer('stale');
  const pendingEvent = await makeEvent(organizer, 'Edited after rejection', 'PENDING', null);
  const cancelledEvent = await makeEvent(organizer, 'Cancelled after approval', 'CANCELLED', null);

  const rejectedResult = await notificationsQueueHandler(queueEventFor('event.rejected', pendingEvent.id, organizer.id));
  const approvedResult = await notificationsQueueHandler(queueEventFor('event.approved', cancelledEvent.id, organizer.id));

  assert.equal(rejectedResult.notifiedCount, 0);
  assert.equal(approvedResult.notifiedCount, 0);
  assert.equal((await notificationsOf(organizer)).length, 0);
});

test('unknown message types and missing events are ignored, every message is counted', async function () {
  const organizer = await makeOrganizer('mixed');
  const event = await makeEvent(organizer, 'Mixed Batch', 'APPROVED', null);
  const queueEvent = {
    Records: [
      queueEventFor('event.approved', event.id, organizer.id).Records[0],
      queueEventFor('event.cancelled', event.id, organizer.id).Records[0],
      queueEventFor('event.approved', 999999999, organizer.id).Records[0],
    ],
  };

  const result = await notificationsQueueHandler(queueEvent);

  assert.deepEqual(result, { messageCount: 3, notifiedCount: 1 });
  assert.equal((await notificationsOf(organizer)).length, 1);
});

test('the organizer reads the notification and marks it as read through the API', async function () {
  const organizer = await makeOrganizer('reader');
  const event = await makeEvent(organizer, 'Readable Event', 'APPROVED', null);
  await notificationsQueueHandler(queueEventFor('event.approved', event.id, organizer.id));

  const list = await callApi('GET', '/api/notifications', organizer);
  assert.equal(list.status, 200);
  assert.equal(list.data.notifications.length, 1);
  assert.equal(list.data.notifications[0].message, 'Your event "Readable Event" was approved.');

  const read = await callApi('PATCH', '/api/notifications/' + list.data.notifications[0].id + '/read', organizer);
  assert.equal(read.status, 200);
  assert.equal(read.data.notification.isRead, true);
});
