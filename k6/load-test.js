import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL;
const PASSWORD = __ENV.DEMO_PASSWORD || 'Password123!';
const ORGANIZER_EMAIL = __ENV.ORGANIZER_EMAIL || 'demo.organizer@campus.test';
const STUDENT_EMAIL = __ENV.STUDENT_EMAIL || 'demo.student@campus.test';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '60s', target: 10 },
    { duration: '20s', target: 30 },
    { duration: '40s', target: 30 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
};

function logIn(email) {
  const response = http.post(API + '/auth/login', JSON.stringify({ email: email, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
  });
  if (response.status !== 200) {
    throw new Error('Login failed for ' + email + ' with status ' + response.status);
  }
  return response.json('token');
}

export function setup() {
  return { organizerToken: logIn(ORGANIZER_EMAIL), studentToken: logIn(STUDENT_EMAIL) };
}

function withToken(token) {
  return { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } };
}

function browseEvents(tokens) {
  const response = http.get(API + '/student/events', withToken(tokens.studentToken));
  check(response, { 'student sees the events': (r) => r.status === 200 });
}

function openMyEvents(tokens) {
  const response = http.get(API + '/events/mine', withToken(tokens.organizerToken));
  check(response, { 'organizer sees my events': (r) => r.status === 200 });
}

function openNotifications(tokens) {
  const response = http.get(API + '/notifications', withToken(tokens.studentToken));
  check(response, { 'student sees notifications': (r) => r.status === 200 });
}

function checkPlace(tokens) {
  const body = JSON.stringify({
    location: 'Load Test Hall',
    startsAt: '2032-03-01T10:00:00Z',
    endsAt: '2032-03-01T11:00:00Z',
  });
  const response = http.post(API + '/events/check', body, withToken(tokens.organizerToken));
  check(response, { 'clash check answers': (r) => r.status === 200 });
}

export default function (tokens) {
  const choice = Math.random();
  if (choice < 0.5) {
    browseEvents(tokens);
  } else if (choice < 0.7) {
    openMyEvents(tokens);
  } else if (choice < 0.85) {
    openNotifications(tokens);
  } else {
    checkPlace(tokens);
  }
  sleep(1);
}
