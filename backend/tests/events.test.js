import 'dotenv/config';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeApp } from '../src/app.js';
import { config } from '../src/shared/config.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { eventsRouter } from '../src/modules/events/events.routes.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { findClashes } from '../src/modules/events/clash.service.js';
import { deleteImageByUrl } from '../src/modules/events/imageStorage.js';
import { cairoMinutesOfDay, cairoDateText } from '../src/shared/cairoTime.js';
import { db } from '../src/db/client.js';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is missing in backend/.env');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const RUN = String(Date.now());
const EMAIL_ENDING = '@events-test.campus';
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5e0d1a40000000049454e44ae426082',
  'hex',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
const FAKE_IMAGE = Buffer.from('<?php echo "not an image"; ?>');
const TOO_BIG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(3 * 1024 * 1024)]);

let server;
let baseUrl;
let categoryId;
const users = {};

function cairo(day, clock) {
  return day + 'T' + clock + ':00+02:00';
}

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

async function uploadImage(eventId, user, bytes, fieldName) {
  const form = new FormData();
  form.append(fieldName || 'image', new Blob([bytes], { type: 'image/png' }), 'poster.png');
  const response = await fetch(baseUrl + '/api/events/' + eventId + '/image', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + user.token },
    body: form,
  });
  return { status: response.status, data: await response.json() };
}

async function makeUser(name, role) {
  const email = name + '-' + RUN + EMAIL_ENDING;
  const passwordHash = await hashPassword('password123');
  const user = await db().user.create({ data: { name: name, email: email, role: role, passwordHash: passwordHash } });
  const login = await callApi('POST', '/api/auth/login', { email: email, password: 'password123' });
  return { id: user.id, token: login.data.token };
}

function eventBody(title, location, day, from, to) {
  return {
    title: title,
    description: 'Test event',
    location: location,
    startsAt: cairo(day, from),
    endsAt: cairo(day, to),
    categoryId: categoryId,
  };
}

async function createEvent(title, location, day, from, to) {
  const response = await callApi('POST', '/api/events', eventBody(title, location, day, from, to), users.organizer);
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.data.event;
}

async function setStatus(eventId, status) {
  await db().event.update({ where: { id: eventId }, data: { status: status } });
}

async function countMyEvents() {
  return db().event.count({ where: { organizerId: users.organizer.id } });
}

async function checkFlociIsRunning() {
  try {
    await fetch(config.s3Endpoint || 'http://localhost:4566');
  } catch (error) {
    throw new Error('Floci is not running. Open Docker Desktop and start infra/floci first.');
  }
}

before(async function () {
  await checkFlociIsRunning();
  const app = makeApp([
    { path: '/api/auth', router: authRouter },
    { path: '/api/events', router: eventsRouter },
  ]);
  server = await startServer(app);
  baseUrl = 'http://localhost:' + server.address().port;
  categoryId = (await db().category.findFirst({ where: { isActive: true } })).id;
  users.organizer = await makeUser('organizer', 'ORGANIZER');
  users.otherOrganizer = await makeUser('other-organizer', 'ORGANIZER');
  users.student = await makeUser('student', 'STUDENT');
  users.admin = await makeUser('admin', 'ADMIN');
});

after(async function () {
  const testUsers = await db().user.findMany({ where: { email: { endsWith: EMAIL_ENDING } }, select: { id: true } });
  const userIds = [];
  for (const testUser of testUsers) {
    userIds.push(testUser.id);
  }
  const eventsWithPosters = await db().event.findMany({
    where: { organizerId: { in: userIds }, imageUrl: { not: null } },
  });
  for (const event of eventsWithPosters) {
    await deleteImageByUrl(event.imageUrl);
  }
  await db().event.deleteMany({ where: { organizerId: { in: userIds } } });
  await db().user.deleteMany({ where: { id: { in: userIds } } });
  await db().$disconnect();
  server.close();
});

const CRUD_DAY = '2030-03-12';
const CRUD_HALL = 'Crud Hall ' + RUN;
let crudEvent;

test('categories: organizer and admin can list them, student cannot', async function () {
  const organizerList = await callApi('GET', '/api/events/categories', undefined, users.organizer);
  const adminList = await callApi('GET', '/api/events/categories', undefined, users.admin);
  const studentList = await callApi('GET', '/api/events/categories', undefined, users.student);
  const noLogin = await callApi('GET', '/api/events/categories');
  assert.equal(organizerList.status, 200);
  assert.ok(organizerList.data.categories.length >= 1);
  assert.equal(adminList.status, 200);
  assert.equal(studentList.status, 403);
  assert.equal(noLogin.status, 401);
});

test('create: a new event is always PENDING', async function () {
  const body = eventBody('Robotics Workshop', CRUD_HALL, CRUD_DAY, '10:00', '12:00');
  body.status = 'APPROVED';
  body.organizerId = users.otherOrganizer.id;
  const response = await callApi('POST', '/api/events', body, users.organizer);
  assert.equal(response.status, 201);
  assert.equal(response.data.event.status, 'PENDING');
  assert.equal(response.data.event.organizerId, users.organizer.id);
  assert.equal(typeof response.data.event.category.name, 'string');
  crudEvent = response.data.event;
});

test('create: only organizers can create events', async function () {
  const body = eventBody('Student Event', CRUD_HALL, CRUD_DAY, '13:00', '14:00');
  const response = await callApi('POST', '/api/events', body, users.student);
  assert.equal(response.status, 403);
});

test('create: bad input gives 400', async function () {
  const good = eventBody('Good Title', CRUD_HALL, CRUD_DAY, '15:00', '16:00');
  const badBodies = [
    { ...good, title: '<script>x</script>' },
    { ...good, location: 'Hall <b>' },
    { ...good, startsAt: good.endsAt, endsAt: good.startsAt },
    { ...good, startsAt: '2020-01-01T10:00:00Z', endsAt: '2020-01-01T11:00:00Z' },
    { ...good, startsAt: 'tomorrow' },
    { ...good, categoryId: 999999999 },
    { ...good, title: undefined },
  ];
  for (const badBody of badBodies) {
    const response = await callApi('POST', '/api/events', badBody, users.organizer);
    assert.equal(response.status, 400, JSON.stringify(badBody));
  }
});

test('mine: an organizer only sees their own events', async function () {
  const mine = await callApi('GET', '/api/events/mine', undefined, users.organizer);
  const other = await callApi('GET', '/api/events/mine', undefined, users.otherOrganizer);
  assert.equal(mine.status, 200);
  assert.ok(mine.data.events.some((event) => event.id === crudEvent.id));
  assert.equal(other.data.events.length, 0);
});

test('get one: owner and admin can read it, others get 404', async function () {
  const owner = await callApi('GET', '/api/events/' + crudEvent.id, undefined, users.organizer);
  const admin = await callApi('GET', '/api/events/' + crudEvent.id, undefined, users.admin);
  const other = await callApi('GET', '/api/events/' + crudEvent.id, undefined, users.otherOrganizer);
  const badId = await callApi('GET', '/api/events/abc', undefined, users.organizer);
  assert.equal(owner.status, 200);
  assert.equal(admin.status, 200);
  assert.equal(other.status, 404);
  assert.equal(badId.status, 400);
});

test('edit: a PENDING event can be edited by its owner only', async function () {
  const edited = await callApi('PATCH', '/api/events/' + crudEvent.id, { title: 'Robotics Workshop 2' }, users.organizer);
  const empty = await callApi('PATCH', '/api/events/' + crudEvent.id, {}, users.organizer);
  const other = await callApi('PATCH', '/api/events/' + crudEvent.id, { title: 'Taken over' }, users.otherOrganizer);
  assert.equal(edited.status, 200);
  assert.equal(edited.data.event.title, 'Robotics Workshop 2');
  assert.equal(empty.status, 400);
  assert.equal(other.status, 404);
});

test('edit: editing a REJECTED event makes it PENDING and clears the reason', async function () {
  await db().event.update({ where: { id: crudEvent.id }, data: { status: 'REJECTED', rejectionReason: 'Too vague' } });
  const response = await callApi('PATCH', '/api/events/' + crudEvent.id, { description: 'Now clearer' }, users.organizer);
  assert.equal(response.status, 200);
  assert.equal(response.data.event.status, 'PENDING');
  assert.equal(response.data.event.rejectionReason, null);
});

test('edit: an APPROVED event cannot be edited', async function () {
  await setStatus(crudEvent.id, 'APPROVED');
  const response = await callApi('PATCH', '/api/events/' + crudEvent.id, { title: 'Changed' }, users.organizer);
  assert.equal(response.status, 409);
});

test('delete: an APPROVED event becomes CANCELLED, and cannot be deleted again', async function () {
  const first = await callApi('DELETE', '/api/events/' + crudEvent.id, undefined, users.organizer);
  const second = await callApi('DELETE', '/api/events/' + crudEvent.id, undefined, users.organizer);
  assert.equal(first.status, 200);
  assert.equal(first.data.result, 'cancelled');
  assert.equal(first.data.event.status, 'CANCELLED');
  assert.equal(second.status, 409);
});

test('delete: a PENDING event is really removed', async function () {
  const event = await createEvent('Short Talk', CRUD_HALL, CRUD_DAY, '17:00', '18:00');
  const response = await callApi('DELETE', '/api/events/' + event.id, undefined, users.organizer);
  const afterDelete = await callApi('GET', '/api/events/' + event.id, undefined, users.organizer);
  assert.equal(response.status, 200);
  assert.equal(response.data.result, 'deleted');
  assert.equal(afterDelete.status, 404);
});

const CLASH_DAY = '2030-03-13';
const CLASH_HALL = 'Clash Hall ' + RUN;
const BUSY_HALL = 'Busy Hall ' + RUN;
const FREE_HALL = 'Free Hall ' + RUN;
const clashEvents = {};

async function assertSlotsAreUsable(slots, location) {
  assert.ok(slots.length >= 1);
  for (const slot of slots) {
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(slot.endsAt);
    assert.ok(startsAt > new Date());
    assert.ok(cairoMinutesOfDay(startsAt) >= 8 * 60);
    assert.ok(cairoMinutesOfDay(endsAt) <= 22 * 60);
    assert.equal(cairoDateText(startsAt), cairoDateText(endsAt));
    assert.equal((await findClashes(location, startsAt, endsAt)).length, 0);
  }
}

test('clash: setup events for the clash tests', async function () {
  clashEvents.morning = await createEvent('Morning Talk', CLASH_HALL, CLASH_DAY, '10:00', '12:00');
  clashEvents.busy = await createEvent('Busy Talk', BUSY_HALL, CLASH_DAY, '10:00', '12:00');
  clashEvents.free = await createEvent('Afternoon Talk', FREE_HALL, CLASH_DAY, '14:00', '16:00');
});

test('clash: same place in other letters and overlapping time gives 409 with alternatives', async function () {
  const body = eventBody('Clashing Talk', CLASH_HALL.toUpperCase(), CLASH_DAY, '11:00', '13:00');
  const response = await callApi('POST', '/api/events', body, users.organizer);
  assert.equal(response.status, 409);
  assert.equal(response.data.clashes.length, 1);
  assert.equal(response.data.clashes[0].id, clashEvents.morning.id);

  const slots = response.data.alternatives.slots;
  assert.equal(slots.length, 3);
  assert.equal(slots[0].startsAt, new Date(cairo(CLASH_DAY, '12:00')).toISOString());
  await assertSlotsAreUsable(slots, CLASH_HALL);

  const places = response.data.alternatives.places;
  assert.ok(places.length >= 1);
  for (const place of places) {
    const clashes = await findClashes(place, new Date(body.startsAt), new Date(body.endsAt));
    assert.equal(clashes.length, 0, place + ' should be free');
  }
  assert.ok(!places.includes(BUSY_HALL));
});

test('clash: alternative slots are ordered nearest first', async function () {
  const body = eventBody('Clashing Again', CLASH_HALL, CLASH_DAY, '11:00', '12:00');
  const response = await callApi('POST', '/api/events', body, users.organizer);
  const wanted = new Date(body.startsAt).getTime();
  let lastDistance = 0;
  for (const slot of response.data.alternatives.slots) {
    const distance = Math.abs(new Date(slot.startsAt).getTime() - wanted);
    assert.ok(distance >= lastDistance);
    lastDistance = distance;
  }
});

test('clash: touching ends do not clash', async function () {
  clashEvents.noon = await createEvent('Noon Talk', CLASH_HALL, CLASH_DAY, '12:00', '13:00');
  assert.equal(clashEvents.noon.status, 'PENDING');
});

test('clash: late suggestions never end after 22:00 Cairo time', async function () {
  await createEvent('Evening Talk', CLASH_HALL, CLASH_DAY, '20:00', '22:00');
  const body = eventBody('Late Talk', CLASH_HALL, CLASH_DAY, '20:30', '22:00');
  const response = await callApi('POST', '/api/events', body, users.organizer);
  assert.equal(response.status, 409);
  await assertSlotsAreUsable(response.data.alternatives.slots, CLASH_HALL);
});

test('check: answers free or busy and saves nothing', async function () {
  const countBefore = await countMyEvents();
  const free = await callApi('POST', '/api/events/check', {
    location: CLASH_HALL, startsAt: cairo(CLASH_DAY, '16:00'), endsAt: cairo(CLASH_DAY, '17:00'),
  }, users.organizer);
  const busy = await callApi('POST', '/api/events/check', {
    location: CLASH_HALL, startsAt: cairo(CLASH_DAY, '11:00'), endsAt: cairo(CLASH_DAY, '11:30'),
  }, users.organizer);
  assert.equal(free.status, 200);
  assert.equal(free.data.free, true);
  assert.equal(busy.status, 200);
  assert.equal(busy.data.free, false);
  assert.ok(busy.data.clashes.length >= 1);
  assert.ok(busy.data.alternatives.slots.length >= 1);
  assert.equal(await countMyEvents(), countBefore);
});

test('check: ignoreEventId lets an event ignore itself, students get 403', async function () {
  const self = await callApi('POST', '/api/events/check', {
    location: CLASH_HALL, startsAt: cairo(CLASH_DAY, '10:00'), endsAt: cairo(CLASH_DAY, '12:00'),
    ignoreEventId: clashEvents.morning.id,
  }, users.organizer);
  const student = await callApi('POST', '/api/events/check', {
    location: CLASH_HALL, startsAt: cairo(CLASH_DAY, '16:00'), endsAt: cairo(CLASH_DAY, '17:00'),
  }, users.student);
  assert.equal(self.data.free, true);
  assert.equal(student.status, 403);
});

test('clash: editing an event does not clash with itself, moving onto a busy time does', async function () {
  const rename = await callApi('PATCH', '/api/events/' + clashEvents.morning.id, { title: 'Morning Talk 2' }, users.organizer);
  const move = await callApi('PATCH', '/api/events/' + clashEvents.noon.id, {
    startsAt: cairo(CLASH_DAY, '11:00'), endsAt: cairo(CLASH_DAY, '12:30'),
  }, users.organizer);
  assert.equal(rename.status, 200);
  assert.equal(move.status, 409);
  assert.equal(move.data.clashes[0].id, clashEvents.morning.id);
});

test('clash: CANCELLED and REJECTED events do not block a place', async function () {
  await setStatus(clashEvents.morning.id, 'CANCELLED');
  await setStatus(clashEvents.busy.id, 'REJECTED');
  const reuseHall = await createEvent('Reuse Hall', CLASH_HALL, CLASH_DAY, '10:00', '11:00');
  const reuseBusy = await createEvent('Reuse Busy', BUSY_HALL, CLASH_DAY, '10:00', '11:00');
  assert.equal(reuseHall.status, 'PENDING');
  assert.equal(reuseBusy.status, 'PENDING');
});

const SERIES_HALL = 'Series Hall ' + RUN;

function seriesBody(startsAt, endsAt, frequency, interval, count) {
  return {
    title: 'Weekly Club',
    description: 'Repeating',
    location: SERIES_HALL,
    startsAt: startsAt,
    endsAt: endsAt,
    categoryId: categoryId,
    frequency: frequency,
    interval: interval,
    count: count,
  };
}

test('series: weekly dates keep the same Cairo clock time over the summer time switch', async function () {
  const body = seriesBody(cairo('2030-04-19', '10:00'), cairo('2030-04-19', '12:00'), 'WEEKLY', 1, 4);
  const response = await callApi('POST', '/api/events/series/preview', body, users.organizer);
  assert.equal(response.status, 200);
  const utcHours = [];
  for (const date of response.data.dates) {
    assert.equal(cairoMinutesOfDay(new Date(date.startsAt)), 10 * 60);
    utcHours.push(new Date(date.startsAt).getUTCHours());
  }
  assert.deepEqual(utcHours, [8, 7, 7, 7]);
});

test('series: monthly dates from the 31st use the last day of short months', async function () {
  const body = seriesBody(cairo('2030-01-31', '18:00'), cairo('2030-01-31', '19:00'), 'MONTHLY', 1, 4);
  const response = await callApi('POST', '/api/events/series/preview', body, users.organizer);
  const days = [];
  for (const date of response.data.dates) {
    days.push(cairoDateText(new Date(date.startsAt)));
  }
  assert.deepEqual(days, ['2030-01-31', '2030-02-28', '2030-03-31', '2030-04-30']);
});

test('series: daily with interval 2 crosses the month end', async function () {
  const body = seriesBody(cairo('2030-02-27', '09:00'), cairo('2030-02-27', '10:00'), 'DAILY', 2, 3);
  const response = await callApi('POST', '/api/events/series/preview', body, users.organizer);
  const days = [];
  for (const date of response.data.dates) {
    days.push(cairoDateText(new Date(date.startsAt)));
  }
  assert.deepEqual(days, ['2030-02-27', '2030-03-01', '2030-03-03']);
});

test('series: preview marks the clashing date and saves nothing', async function () {
  await createEvent('Blocker', SERIES_HALL, '2030-03-11', '16:30', '18:00');
  const countBefore = await countMyEvents();
  const body = seriesBody(cairo('2030-03-04', '16:00'), cairo('2030-03-04', '17:00'), 'WEEKLY', 1, 4);
  const response = await callApi('POST', '/api/events/series/preview', body, users.organizer);
  assert.equal(response.data.freeCount, 3);
  assert.equal(response.data.clashCount, 1);
  assert.equal(response.data.dates[1].free, false);
  assert.equal(await countMyEvents(), countBefore);
});

test('series: onClash reject creates nothing when one date clashes', async function () {
  const countBefore = await countMyEvents();
  const body = seriesBody(cairo('2030-03-04', '16:00'), cairo('2030-03-04', '17:00'), 'WEEKLY', 1, 4);
  body.onClash = 'reject';
  const response = await callApi('POST', '/api/events/series', body, users.organizer);
  assert.equal(response.status, 409);
  assert.equal(response.data.clashingDates.length, 1);
  assert.equal(await countMyEvents(), countBefore);
});

test('series: onClash skip creates the free dates with one seriesId', async function () {
  const body = seriesBody(cairo('2030-03-04', '16:00'), cairo('2030-03-04', '17:00'), 'WEEKLY', 1, 4);
  body.onClash = 'skip';
  const response = await callApi('POST', '/api/events/series', body, users.organizer);
  assert.equal(response.status, 201);
  assert.equal(response.data.created.length, 3);
  assert.equal(response.data.skipped.length, 1);
  for (const event of response.data.created) {
    assert.equal(event.seriesId, response.data.seriesId);
    assert.equal(event.status, 'PENDING');
  }
  const again = await callApi('POST', '/api/events/series', body, users.organizer);
  assert.equal(again.status, 409);
});

test('series: bad repeat settings give 400, students get 403', async function () {
  const good = seriesBody(cairo('2030-05-06', '09:00'), cairo('2030-05-06', '10:00'), 'WEEKLY', 1, 3);
  const badBodies = [
    { ...good, count: 1 },
    { ...good, count: 21 },
    { ...good, frequency: 'YEARLY' },
    { ...good, endsAt: cairo('2030-05-07', '16:00') },
  ];
  for (const badBody of badBodies) {
    const response = await callApi('POST', '/api/events/series', badBody, users.organizer);
    assert.equal(response.status, 400, JSON.stringify(badBody));
  }
  const student = await callApi('POST', '/api/events/series', good, users.student);
  assert.equal(student.status, 403);
});

const POSTER_DAY = '2030-03-14';
const POSTER_HALL = 'Poster Hall ' + RUN;
const posterEvents = {};

test('image: setup events for the image tests', async function () {
  posterEvents.pending = await createEvent('Poster Event', POSTER_HALL, POSTER_DAY, '10:00', '11:00');
  posterEvents.approved = await createEvent('Approved Event', POSTER_HALL, POSTER_DAY, '12:00', '13:00');
  await setStatus(posterEvents.approved.id, 'APPROVED');
});

test('image: a real PNG is saved with a random name and can be read publicly', async function () {
  const response = await uploadImage(posterEvents.pending.id, users.organizer, PNG);
  assert.equal(response.status, 200);
  const imageUrl = response.data.event.imageUrl;
  assert.match(imageUrl, /\/events\/[0-9a-f-]{36}\.png$/);
  const publicFile = await fetch(imageUrl);
  assert.equal(publicFile.status, 200);
  assert.ok(Buffer.from(await publicFile.arrayBuffer()).equals(PNG));
  posterEvents.firstUrl = imageUrl;
});

test('image: replacing the poster deletes the old file', async function () {
  const response = await uploadImage(posterEvents.pending.id, users.organizer, JPEG);
  assert.equal(response.status, 200);
  assert.match(response.data.event.imageUrl, /\.jpg$/);
  assert.equal((await fetch(posterEvents.firstUrl)).status, 404);
  assert.equal((await fetch(response.data.event.imageUrl)).status, 200);
});

test('image: a fake image, a too big file or a wrong field are refused', async function () {
  const fake = await uploadImage(posterEvents.pending.id, users.organizer, FAKE_IMAGE);
  const big = await uploadImage(posterEvents.pending.id, users.organizer, TOO_BIG);
  const wrongField = await uploadImage(posterEvents.pending.id, users.organizer, PNG, 'photo');
  assert.equal(fake.status, 400);
  assert.equal(big.status, 413);
  assert.equal(wrongField.status, 400);
});

test('image: only the owner can upload, and not on an APPROVED event', async function () {
  const other = await uploadImage(posterEvents.pending.id, users.otherOrganizer, PNG);
  const student = await uploadImage(posterEvents.pending.id, users.student, PNG);
  const approved = await uploadImage(posterEvents.approved.id, users.organizer, PNG);
  assert.equal(other.status, 404);
  assert.equal(student.status, 403);
  assert.equal(approved.status, 409);
});

test('image: removing the poster clears the URL and deletes the file', async function () {
  const current = await db().event.findUnique({ where: { id: posterEvents.pending.id } });
  const removed = await callApi('DELETE', '/api/events/' + posterEvents.pending.id + '/image', undefined, users.organizer);
  const again = await callApi('DELETE', '/api/events/' + posterEvents.pending.id + '/image', undefined, users.organizer);
  assert.equal(removed.status, 200);
  assert.equal(removed.data.event.imageUrl, null);
  assert.equal((await fetch(current.imageUrl)).status, 404);
  assert.equal(again.status, 404);
});

test('image: deleting a PENDING event also deletes its poster', async function () {
  const upload = await uploadImage(posterEvents.pending.id, users.organizer, PNG);
  const imageUrl = upload.data.event.imageUrl;
  const deleted = await callApi('DELETE', '/api/events/' + posterEvents.pending.id, undefined, users.organizer);
  assert.equal(deleted.data.result, 'deleted');
  assert.equal((await fetch(imageUrl)).status, 404);
});
