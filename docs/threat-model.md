# Threat model: Campus Events Calendar

Owner: Mazen (shared task "threat model"). Last checked against the code in `main` on 2026-11-26.

This document lists what can go wrong, how the code already stops it, and what is still a risk. Every protection points to the file that does it, so it can be checked.

---

## 1. What we protect

| Asset | Why it matters |
|---|---|
| User passwords | Reused passwords could open other accounts of the user |
| Session tokens | Whoever has a token acts as that user for 8 hours |
| Event data and its status | Only approved events may appear on the student calendar |
| Admin decisions (approve, reject, flags, categories) | A wrong or fake decision changes what every student sees |
| Audit log | Proof of who did what |
| Database connection string (`DATABASE_URL`) | Gives full access to all data |
| Uploaded posters in S3 | Public files, must not be harmful |
| Student registrations and notifications | Personal data of students |

## 2. Who uses the system

| Actor | Trust |
|---|---|
| Visitor (not logged in) | Untrusted. Can only register, log in and call health |
| Student | Logged in, low trust. Sees approved events, saves, registers, reports |
| Organizer | Logged in, medium trust. Manages only their own events |
| Admin | Logged in, high trust. Reviews events, flags and categories |
| Attacker | Anyone on the internet, may have a stolen token or a student account |

## 3. Trust boundaries

```
Browser (React) --HTTPS--> API Gateway --> module Lambda --> Neon Postgres
                                              |--> S3 (posters)
                                              |--> SNS topic --> SQS queues --> queue Lambdas
EventBridge schedules --> lifecycle / reminders / digest Lambdas
All Lambdas --> CloudWatch Logs; CloudWatch alarms --> SNS campus-alerts
```

Everything that comes from the browser crosses a boundary and is checked again on the server. Messages between modules (SNS/SQS) only carry ids; the listening Lambda reads the current data from the database itself.

---

## 4. Threats and how they are handled

The letters follow STRIDE: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege.

### 4.1 Accounts and sessions

| # | Threat | Type | How the code stops it | Where |
|---|---|---|---|---|
| A1 | Password guessing on login | S | 10 login attempts per minute per IP, then 429 | `shared/middleware/rateLimit.js`, `auth.routes.js` |
| A2 | Finding out which emails have accounts | I | Wrong email and wrong password give the same answer: 401 "Wrong email or password" | `auth.service.js` |
| A3 | Database leak reveals passwords | I | Passwords stored only as scrypt hash with a random 16-byte salt | `auth/password.js` |
| A4 | Database leak reveals usable tokens | S | Token is 32 random bytes; only its SHA-256 hash is stored | `auth.service.js` |
| A5 | Stolen token used forever | S | Sessions end after 8 hours, expired sessions are deleted; logout deletes the session | `auth.service.js` |
| A6 | Someone signs up as Admin or Organizer | E | Public register always creates a STUDENT, a sent `role` is ignored (tested) | `auth.service.js`, `tests/auth.test.js` |

### 4.2 Roles and ownership

| # | Threat | Type | How the code stops it | Where |
|---|---|---|---|---|
| R1 | Calling a route without logging in | S | `requireAuth` on every route except register, login, health: 401 | `shared/middleware/auth.js` |
| R2 | Student or organizer calls admin routes | E | All admin routes use `requireRole('ADMIN')`: 403 (tested for every admin list route) | `admin.routes.js`, `tests/admin.test.js` |
| R3 | Organizer changes another organizer's event | E/T | `findOwnedEvent` checks the event's `organizerId` is the logged-in user; someone else's event answers 404, so it does not even reveal that the event exists | `events.service.js` |
| R4 | Organizer edits an approved event to sneak in changes | T | Approved events cannot be edited (409); only the reschedule check may change them | `events.service.js` |
| R5 | Admin approves the same event twice, or a cancelled one | T | Only PENDING events can be reviewed, only OPEN flags can be handled (409) | `admin.service.js`, `flags.service.js` |

### 4.3 Input

| # | Threat | Type | How the code stops it | Where |
|---|---|---|---|---|
| I1 | SQL injection | T/I | All database access goes through Prisma with parameters. No raw SQL anywhere (`$queryRaw` is not used) | `db/client.js`, all services |
| I2 | Stored XSS (script in an event title, reason or category name) | T | zod refuses `<` and `>` in text fields; React prints server text as plain text, `dangerouslySetInnerHTML` is never used | `*.schema.js`, `frontend/src` |
| I3 | Wrong types or huge bodies | D/T | Every body is checked with zod (400); JSON bodies limited to 50 kB (413) | `validate.js`, `app.js` |
| I4 | Fake image (for example a PHP or HTML file named `.png`) | T | The file type is read from its first bytes: only JPEG, PNG or WebP; max 2 MB; one file | `events/image.service.js`, `events/upload.js` |
| I5 | Upload overwrites another file or guesses names | T | Files get a random UUID name under `events/` | `events/image.service.js` |

### 4.4 Data exposure

| # | Threat | Type | How the code stops it | Where |
|---|---|---|---|---|
| D1 | API answers leak password hashes | I | Users are always returned with selected fields only (id, name, email, role) | `admin.service.js`, `flags.service.js`, auth service |
| D2 | Logs leak secrets | I | Request log has only method, path without query string, status, time and user id. Never body, headers, tokens or passwords | `shared/middleware/requestLogger.js` |
| D3 | Database password in git | I | `.env` is in `.gitignore`; `.env.example` has fake values only | `.gitignore`, `backend/.env.example` |
| D4 | Students see pending or rejected events | I | Student browsing only returns APPROVED events (and CANCELLED ones, so students know they are off); reporting checks the event is APPROVED | `student/browse.service.js`, `report.service.js` |
| D5 | Browser security headers missing | I | `helmet` sets safe headers on every answer | `app.js` |

### 4.5 Admin work and accountability

| # | Threat | Type | How the code stops it | Where |
|---|---|---|---|---|
| M1 | An admin (or a stolen admin token) denies a decision | R | Every approve, reject, category change and flag decision writes an `AuditLog` row with the admin's id | `audit/audit.service.js`, admin services |
| M2 | Admin cancels an event by mistake through a flag | T | The page asks for confirmation before resolving a flag on an approved event; the audit row records `eventCancelled` | `pages/admin/Flags.jsx`, `flags.service.js` |
| M3 | Students spam reports | D | One OPEN report per student per event (409); only approved events can be reported | `student/report.service.js` |
| M4 | A bad organizer keeps submitting bad events | T | Trust score from past approvals, rejections and resolved flags is shown next to each pending event | `admin/trust.service.js` |

### 4.6 Cloud and messages

| # | Threat | Type | How the code stops it | Where |
|---|---|---|---|---|
| C1 | A message is lost when a Lambda fails | D | SQS keeps it; after 3 failed tries it moves to a `-failed` queue | `infra/triggers-setup.sh` |
| C2 | Failures go unnoticed | R/D | CloudWatch alarms on errors of all 10 Lambdas and on messages in the failed queues, sent to `campus-alerts` | `infra/monitoring-setup.sh` |
| C3 | Lambdas can do too much if one is broken into | E | IAM role only allows: logs, publish to `campus-events`, read/delete from the two queues, put/delete in `events/*` of the bucket | `infra/iam-setup.sh` |
| C4 | A forged message makes a Lambda act on wrong data | T | Messages only carry ids; the listener re-reads the event and checks its status (for example only notifies "approved" if it really is APPROVED) | `notifications/eventReview.service.js`, `student/eventChanges.service.js` |
| C5 | Public bucket exposes everything | I | Only `events/*` is public-read (posters); nothing else in the bucket is public | `infra/s3-setup.sh` |

---

## 5. Remaining risks

These are known and accepted for a university project, with what would fix them.

| # | Risk | Why it is still open | How to fix it |
|---|---|---|---|
| O1 | Token in `sessionStorage` can be read by JavaScript | If XSS ever got through, a script could read the token. I2 lowers the chance a lot | An `HttpOnly` cookie with CSRF protection |
| O2 | Login rate limit is per Lambda instance | The limit is kept in memory; several Lambda copies each count on their own, so the real limit is higher | API Gateway throttling or a shared store |
| O3 | Only login is rate limited | Register and other routes have no limit, so they could be flooded | API Gateway throttling for all routes |
| O4 | `DATABASE_URL` is a Lambda environment variable | Anyone who can read the Lambda settings sees it. The guide planned Secrets Manager | Store it in Secrets Manager and read it at start |
| O5 | One IAM role for all 10 Lambdas | Each Lambda has the permissions of all of them (for example auth could write to S3) | One role per Lambda with only its own permissions |
| O6 | CORS is `*` by default | Fine while developing; any site could call the API from a browser (it still needs a token) | Set `CORS_ORIGINS` and the S3 `CORS_ORIGIN` to the real site address |
| O7 | No alarm subscriber | Alarms go to `campus-alerts`, but nobody is subscribed yet | Subscribe the team's email to `campus-alerts` |
| O8 | Audit row not in the same transaction as the change | If the database failed between the two writes, the change would have no audit row | Write both in one Prisma transaction |
| O9 | Two admins review the same event at the same moment | Both could pass the PENDING check | Update with `where: { id, status: 'PENDING' }` and check the count |
| O10 | Capacity can be passed by one or two places | Two students registering at the same moment can both pass the count check (one student cannot register twice: unique `eventId + userId`) | Count and create inside one transaction |
| O11 | Posters are not virus scanned | Only the type is checked from the first bytes | An S3 scan on upload |
| O12 | Admin accounts have no second factor | A stolen admin password is enough | MFA for admins |

## 6. How to check the protections

- `cd backend && npm test`: 84 tests, including 401, 403, 409, 400, 413 and 429 cases, fake images, and password and token hashing.
- `MSYS_NO_PATHCONV=1 aws logs tail /aws/lambda/campus-events --since 1h`: request lines without secrets.
- `aws cloudwatch describe-alarms --alarm-name-prefix campus-`: the 12 alarms.
