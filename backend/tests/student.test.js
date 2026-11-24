import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from '../src/app.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { studentRouter } from '../src/modules/student/student.routes.js';
import { notificationsRouter } from '../src/modules/notifications/notifications.routes.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { countRegistrations, listRegisteredStudentIds } from '../src/modules/student/registration.service.js';
import { createNotification } from '../src/modules/notifications/notifications.service.js';
import { remindersHandler } from '../src/modules/student/lambda.js';
import { db } from '../src/db/client.js';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is missing in backend/.env');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const RUN = String(Date.now());
const EMAIL_ENDING = '@student-test.campus';
const CATEGORY_ENDING = ' ' + RUN;
const ONE_MINUTE = 60 * 1000;
const ONE_DAY = 24 * 60 * ONE_MINUTE;

let server;
let baseUrl;
let categoryId;
let offCategoryId;
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

function fromNow(milliseconds) {
  return new Date(Date.now() + milliseconds);
}

async function makeEvent(title, status, startsAt, capacity) {
  return db().event.create({
    data: {
      title: title,
      description: 'Student test event',
      location: 'Student Test Room ' + RUN,
      startsAt: startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * ONE_MINUTE),
      capacity: capacity,
      status: status,
      organizerId: users.organizer.id,
      categoryId: categoryId,
    },
  });
}

async function findAuditRow(action, actorId, entityId) {
  return db().auditLog.findFirst({ where: { action: action, actorId: actorId, entityId: entityId } });
}

function listIds(items, readId) {
  const ids = [];
  for (const item of items) {
    ids.push(readId(item));
  }
  return ids;
}

before(async function () {
  const app = makeApp([
    { path: '/api/auth', router: authRouter },
    { path: '/api/student', router: studentRouter },
    { path: '/api/notifications', router: notificationsRouter },
  ]);
  server = await startServer(app);
  baseUrl = 'http://localhost:' + server.address().port;
  const category = await db().category.create({ data: { name: 'Student Test' + CATEGORY_ENDING } });
  categoryId = category.id;
  const offCategory = await db().category.create({ data: { name: 'Turned Off' + CATEGORY_ENDING, isActive: false } });
  offCategoryId = offCategory.id;
  users.student = await makeUser('student', 'STUDENT');
  users.otherStudent = await makeUser('other-student', 'STUDENT');
  users.organizer = await makeUser('organizer', 'ORGANIZER');
  users.admin = await makeUser('admin', 'ADMIN');
});

after(async function () {
  const testUsers = await db().user.findMany({ where: { email: { endsWith: EMAIL_ENDING } }, select: { id: true } });
  const userIds = listIds(testUsers, function (testUser) {
    return testUser.id;
  });
  await db().auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await db().event.deleteMany({ where: { organizerId: { in: userIds } } });
  await db().user.deleteMany({ where: { id: { in: userIds } } });
  await db().category.deleteMany({ where: { name: { endsWith: CATEGORY_ENDING } } });
  await db().$disconnect();
  server.close();
});

test('student routes need a login (401) and the STUDENT role (403)', async function () {
  const paths = ['/api/student/registrations', '/api/student/saved', '/api/student/reminders', '/api/student/digest'];
  for (const path of paths) {
    const noLogin = await callApi('GET', path);
    assert.equal(noLogin.status, 401);
    const asOrganizer = await callApi('GET', path, undefined, users.organizer);
    assert.equal(asOrganizer.status, 403);
  }
  const sendAsStudent = await callApi('POST', '/api/student/reminders/send-due', undefined, users.student);
  assert.equal(sendAsStudent.status, 403);
});

test('register, refuse a second time, list, cancel, with audit rows', async function () {
  const event = await makeEvent('Register me', 'APPROVED', fromNow(5 * ONE_DAY), null);
  const path = '/api/student/events/' + event.id + '/registration';

  const registered = await callApi('POST', path, undefined, users.student);
  assert.equal(registered.status, 201);
  assert.equal(registered.data.registration.event.id, event.id);

  const again = await callApi('POST', path, undefined, users.student);
  assert.equal(again.status, 409);

  const list = await callApi('GET', '/api/student/registrations', undefined, users.student);
  const eventIds = listIds(list.data.registrations, function (registration) {
    return registration.eventId;
  });
  assert.equal(eventIds.includes(event.id), true);

  const cancelled = await callApi('DELETE', path, undefined, users.student);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.result, 'cancelled');

  const cancelAgain = await callApi('DELETE', path, undefined, users.student);
  assert.equal(cancelAgain.status, 404);

  assert.ok(await findAuditRow('registration.created', users.student.id, event.id));
  assert.ok(await findAuditRow('registration.cancelled', users.student.id, event.id));
});

test('register refuses pending (404), started (409), full (409) events and bad ids (400)', async function () {
  const pending = await makeEvent('Still pending', 'PENDING', fromNow(5 * ONE_DAY), null);
  const pendingAnswer = await callApi('POST', '/api/student/events/' + pending.id + '/registration', undefined, users.student);
  assert.equal(pendingAnswer.status, 404);

  const started = await makeEvent('Already started', 'APPROVED', fromNow(-10 * ONE_MINUTE), null);
  const startedAnswer = await callApi('POST', '/api/student/events/' + started.id + '/registration', undefined, users.student);
  assert.equal(startedAnswer.status, 409);

  const small = await makeEvent('One place only', 'APPROVED', fromNow(5 * ONE_DAY), 1);
  const first = await callApi('POST', '/api/student/events/' + small.id + '/registration', undefined, users.student);
  assert.equal(first.status, 201);
  const second = await callApi('POST', '/api/student/events/' + small.id + '/registration', undefined, users.otherStudent);
  assert.equal(second.status, 409);
  assert.equal(second.data.error, 'This event is full');

  const badId = await callApi('POST', '/api/student/events/abc/registration', undefined, users.student);
  assert.equal(badId.status, 400);
});

test('countRegistrations and listRegisteredStudentIds count only active registrations', async function () {
  const event = await makeEvent('Count me', 'APPROVED', fromNow(5 * ONE_DAY), null);
  const path = '/api/student/events/' + event.id + '/registration';
  await callApi('POST', path, undefined, users.student);
  await callApi('POST', path, undefined, users.otherStudent);
  assert.equal(await countRegistrations(event.id), 2);

  await callApi('DELETE', path, undefined, users.otherStudent);
  assert.equal(await countRegistrations(event.id), 1);
  assert.deepEqual(await listRegisteredStudentIds(event.id), [users.student.id]);
});

test('save, refuse a second save, list, unsave', async function () {
  const event = await makeEvent('Save me', 'APPROVED', fromNow(5 * ONE_DAY), null);
  const path = '/api/student/events/' + event.id + '/save';

  const saved = await callApi('POST', path, undefined, users.student);
  assert.equal(saved.status, 201);
  const again = await callApi('POST', path, undefined, users.student);
  assert.equal(again.status, 409);

  const list = await callApi('GET', '/api/student/saved', undefined, users.student);
  const eventIds = listIds(list.data.savedEvents, function (savedEvent) {
    return savedEvent.eventId;
  });
  assert.equal(eventIds.includes(event.id), true);

  const unsaved = await callApi('DELETE', path, undefined, users.student);
  assert.equal(unsaved.data.result, 'unsaved');
  const unsaveAgain = await callApi('DELETE', path, undefined, users.student);
  assert.equal(unsaveAgain.status, 404);

  const pending = await makeEvent('Pending save', 'PENDING', fromNow(5 * ONE_DAY), null);
  const pendingAnswer = await callApi('POST', '/api/student/events/' + pending.id + '/save', undefined, users.student);
  assert.equal(pendingAnswer.status, 404);
});

test('follow, refuse turned off categories, list with isFollowed, unfollow', async function () {
  const followPath = '/api/student/categories/' + categoryId + '/follow';
  const followed = await callApi('POST', followPath, undefined, users.otherStudent);
  assert.equal(followed.status, 201);
  const again = await callApi('POST', followPath, undefined, users.otherStudent);
  assert.equal(again.status, 409);

  const turnedOff = await callApi('POST', '/api/student/categories/' + offCategoryId + '/follow', undefined, users.otherStudent);
  assert.equal(turnedOff.status, 404);

  const all = await callApi('GET', '/api/student/categories', undefined, users.otherStudent);
  let isFollowed = null;
  for (const category of all.data.categories) {
    assert.notEqual(category.id, offCategoryId);
    if (category.id === categoryId) {
      isFollowed = category.isFollowed;
    }
  }
  assert.equal(isFollowed, true);

  const mine = await callApi('GET', '/api/student/followed-categories', undefined, users.otherStudent);
  assert.deepEqual(listIds(mine.data.categories, function (category) {
    return category.id;
  }), [categoryId]);

  const unfollowed = await callApi('DELETE', followPath, undefined, users.otherStudent);
  assert.equal(unfollowed.data.result, 'unfollowed');
  const unfollowAgain = await callApi('DELETE', followPath, undefined, users.otherStudent);
  assert.equal(unfollowAgain.status, 404);
});

test('report creates one OPEN flag, refuses a second open report and bad reasons', async function () {
  const event = await makeEvent('Report me', 'APPROVED', fromNow(5 * ONE_DAY), null);
  const path = '/api/student/events/' + event.id + '/report';

  const reported = await callApi('POST', path, { reason: 'The room number is wrong' }, users.student);
  assert.equal(reported.status, 201);
  assert.equal(reported.data.flag.status, 'OPEN');
  assert.ok(await findAuditRow('flag.created', users.student.id, reported.data.flag.id));

  const again = await callApi('POST', path, { reason: 'Still wrong room' }, users.student);
  assert.equal(again.status, 409);

  const badBodies = [{}, { reason: 'bad' }, { reason: '<b>bad room</b>' }, { reason: 'x'.repeat(501) }];
  for (const badBody of badBodies) {
    const answer = await callApi('POST', path, badBody, users.otherStudent);
    assert.equal(answer.status, 400);
  }

  const pending = await makeEvent('Pending report', 'PENDING', fromNow(5 * ONE_DAY), null);
  const pendingAnswer = await callApi('POST', '/api/student/events/' + pending.id + '/report', { reason: 'Looks wrong' }, users.student);
  assert.equal(pendingAnswer.status, 404);
});

test('reminders need a saved or registered event and a time still in the future', async function () {
  const event = await makeEvent('Remind me', 'APPROVED', fromNow(5 * ONE_DAY), null);
  const path = '/api/student/events/' + event.id + '/reminders';

  const notSaved = await callApi('POST', path, { minutesBefore: 60 }, users.student);
  assert.equal(notSaved.status, 409);

  await callApi('POST', '/api/student/events/' + event.id + '/save', undefined, users.student);
  const created = await callApi('POST', path, { minutesBefore: 60 }, users.student);
  assert.equal(created.status, 201);
  assert.equal(created.data.reminder.sentAt, null);

  const same = await callApi('POST', path, { minutesBefore: 60 }, users.student);
  assert.equal(same.status, 409);
  const badMinutes = await callApi('POST', path, { minutesBefore: 2 }, users.student);
  assert.equal(badMinutes.status, 400);

  const soon = await makeEvent('Starts soon', 'APPROVED', fromNow(10 * ONE_MINUTE), null);
  await callApi('POST', '/api/student/events/' + soon.id + '/save', undefined, users.student);
  const passed = await callApi('POST', '/api/student/events/' + soon.id + '/reminders', { minutesBefore: 60 }, users.student);
  assert.equal(passed.status, 409);

  const reminderPath = '/api/student/reminders/' + created.data.reminder.id;
  const notMine = await callApi('DELETE', reminderPath, undefined, users.otherStudent);
  assert.equal(notMine.status, 404);
  const deleted = await callApi('DELETE', reminderPath, undefined, users.student);
  assert.equal(deleted.data.result, 'deleted');
});

test('send due reminders notifies once, and skips cancelled events', async function () {
  const event = await makeEvent('Due reminder', 'APPROVED', fromNow(30 * ONE_DAY), null);
  const cancelled = await makeEvent('Cancelled reminder', 'CANCELLED', fromNow(30 * ONE_DAY), null);
  const dueReminder = await db().reminder.create({
    data: { eventId: event.id, userId: users.otherStudent.id, remindAt: fromNow(-ONE_MINUTE) },
  });
  const cancelledReminder = await db().reminder.create({
    data: { eventId: cancelled.id, userId: users.otherStudent.id, remindAt: fromNow(-ONE_MINUTE) },
  });

  const response = await callApi('POST', '/api/student/reminders/send-due', undefined, users.admin);
  assert.equal(response.status, 200);
  await remindersHandler();

  const notifications = await db().notification.findMany({
    where: { userId: users.otherStudent.id, message: { startsWith: 'Reminder: "Due reminder"' } },
  });
  assert.equal(notifications.length, 1);
  const cancelledNotifications = await db().notification.count({
    where: { userId: users.otherStudent.id, message: { contains: 'Cancelled reminder' } },
  });
  assert.equal(cancelledNotifications, 0);

  const sentDue = await db().reminder.findUnique({ where: { id: dueReminder.id } });
  const sentCancelled = await db().reminder.findUnique({ where: { id: cancelledReminder.id } });
  assert.notEqual(sentDue.sentAt, null);
  assert.notEqual(sentCancelled.sentAt, null);
});

test('notifications: list mine, mark as read, refuse others and empty messages', async function () {
  const created = await createNotification(users.student.id, 'Hello from the test');
  const list = await callApi('GET', '/api/notifications', undefined, users.student);
  assert.equal(list.status, 200);
  const ids = listIds(list.data.notifications, function (notification) {
    return notification.id;
  });
  assert.equal(ids.includes(created.id), true);

  const notMine = await callApi('PATCH', '/api/notifications/' + created.id + '/read', undefined, users.otherStudent);
  assert.equal(notMine.status, 404);
  const read = await callApi('PATCH', '/api/notifications/' + created.id + '/read', undefined, users.student);
  assert.equal(read.data.notification.isRead, true);

  const noLogin = await callApi('GET', '/api/notifications');
  assert.equal(noLogin.status, 401);

  await assert.rejects(createNotification(users.student.id, '   '), { status: 400 });
});

test('recommendations show followed category events, not saved ones, with a reason', async function () {
  const newStudent = await makeUser('recommend-student', 'STUDENT');
  const empty = await callApi('GET', '/api/student/recommendations', undefined, newStudent);
  assert.deepEqual(empty.data.recommendations, []);

  const suggested = await makeEvent('Suggest me', 'APPROVED', fromNow(6 * ONE_DAY), null);
  const alreadySaved = await makeEvent('Saved already', 'APPROVED', fromNow(6 * ONE_DAY), null);
  await callApi('POST', '/api/student/categories/' + categoryId + '/follow', undefined, newStudent);
  await callApi('POST', '/api/student/events/' + alreadySaved.id + '/save', undefined, newStudent);

  const response = await callApi('GET', '/api/student/recommendations', undefined, newStudent);
  assert.equal(response.status, 200);
  let suggestedReason = null;
  for (const recommendation of response.data.recommendations) {
    assert.notEqual(recommendation.event.id, alreadySaved.id);
    if (recommendation.event.id === suggested.id) {
      suggestedReason = recommendation.reason;
    }
  }
  assert.equal(suggestedReason, 'You follow Student Test' + CATEGORY_ENDING);
});

test('digest shows only the next 7 days and the send job creates a notification', async function () {
  const digestStudent = await makeUser('digest-student', 'STUDENT');
  await callApi('POST', '/api/student/categories/' + categoryId + '/follow', undefined, digestStudent);
  const thisWeek = await makeEvent('This week event', 'APPROVED', fromNow(3 * ONE_DAY), null);
  const later = await makeEvent('Later event', 'APPROVED', fromNow(20 * ONE_DAY), null);

  const digest = await callApi('GET', '/api/student/digest', undefined, digestStudent);
  const eventIds = listIds(digest.data.digest.events, function (event) {
    return event.id;
  });
  assert.equal(eventIds.includes(thisWeek.id), true);
  assert.equal(eventIds.includes(later.id), false);

  const sent = await callApi('POST', '/api/student/digest/send', undefined, users.admin);
  assert.equal(sent.status, 200);
  const notifications = await db().notification.findMany({ where: { userId: digestStudent.id } });
  assert.equal(notifications.length, 1);
  assert.ok(notifications[0].message.startsWith('This week: '));
});

test('weather says not available too far ahead and refuses pending events', async function () {
  const farAway = await makeEvent('Far away', 'APPROVED', fromNow(30 * ONE_DAY), null);
  const response = await callApi('GET', '/api/student/events/' + farAway.id + '/weather', undefined, users.student);
  assert.equal(response.status, 200);
  assert.equal(response.data.weather.available, false);

  const pending = await makeEvent('Pending weather', 'PENDING', fromNow(3 * ONE_DAY), null);
  const pendingAnswer = await callApi('GET', '/api/student/events/' + pending.id + '/weather', undefined, users.student);
  assert.equal(pendingAnswer.status, 404);
});
