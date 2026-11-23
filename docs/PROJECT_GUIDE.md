# Campus Events Calendar: Project Guide

This file explains the whole project, its structure, the packages, and contains the prompt to give Claude Code.

**The project is being built from scratch.** Nothing from earlier work is reused as code. Only the decisions in this guide are kept. Section 4b has the build order and the prompts to give Claude Code one step at a time.
Keep it in the repo (for example `docs/PROJECT_GUIDE.md`). Copy section 11 into a file named `CLAUDE.md` in the repo root so Claude Code reads it automatically.

---

## 1. What the project is

**Campus Events Calendar** (Intro to Cloud group project). Clubs and departments submit events, an admin approves them into one shared calendar, and students filter events by category, save them, and get reminders.

| Member | Story | Shared task |
|---|---|---|
| Mahmoud Maged | S1: events (role Organizer) | Authentication / identity + cloud deployment |
| Mazen (Moatazbellah Abdelsalam Hassan) | S2: admin and approval | Logging and monitoring, report, threat model |
| Amin (Mohamed Amin Shehata) | S3: student calendar | Database setup + external API integration |

TA feedback to respect: functions must not be plain CRUD, they must **interact with each other** (one function calls another). Wide scope is fine if every member fully understands the code.

## 2. Roles and what each can do

| Role | Can do |
|---|---|
| Student | Sign up (public sign-up always makes a Student), browse approved events, filter by category, save events, register, get reminders |
| Organizer | Create, edit and delete their own events, upload a poster, create repeating series, see clash warnings |
| Admin | Review events (approve or reject), manage categories, handle flags, see everything |

## 3. Event life cycle

```
Pending --(admin approves)--> Approved --(organizer deletes)--> Cancelled
Pending --(admin rejects)---> Rejected --(organizer edits)----> Pending again
(later) Approved --(event time passes)--> Completed
```

Rules:
- A new event is always **Pending**.
- Pending and Rejected events can be edited. Editing a Rejected event makes it Pending again and clears the rejection reason.
- Approved events cannot be edited (409). Changing them is the future "reschedule impact check".
- Delete: Pending or Rejected is removed for real (its poster too). Approved becomes Cancelled.
- **Clash** = same location (not case sensitive) and overlapping time, checked against Pending and Approved events. Touching ends (12:00 end, 12:00 start) do not clash.
- When there is a clash the API answers 409 with the clashing events and up to 3 free alternative slots (nearest first, between 08:00 and 22:00 Cairo time, never in the past) plus up to 3 free places at the same time.

## 4. The "interacting functions" (answer to the TA)

| Function | Owner | Uses |
|---|---|---|
| Clash detection | Mahmoud | Called by create, update and series creation |
| Recurring series generator | Mahmoud | Calls clash detection for every date, saves all events in one transaction |
| Image upload | Mahmoud | Checks the event rules (owner, status), stores the file in S3, event delete removes the picture |
| Capacity advisor (later) | Mahmoud | Needs Amin's registration data |
| Reschedule impact check (later) | Mahmoud | Needs Amin's registration data, then notifies registered students |
| Review / trust score | Mazen (not Mahmoud's work) | Reads event data, writes audit log, creates notifications |
| Reminders / digest / recommend | Amin (not Mahmoud's work) | Read saved events and followed categories, create notifications |

Every module runs as its own Lambda, so modules talk to each other in two ways:
- **Need an answer right now** (for example events asks clash detection, which is inside the same module): import the service and call it. The bundler puts the imported code inside that Lambda.
- **Tell another module that something happened** (for example "event approved", "event rescheduled", "user registered"): publish a message. SNS sends it out, an SQS queue holds it, and the other module's Lambda reads it from the queue. EventBridge runs timed jobs (for example "send due reminders" every 15 minutes).

Never call another module through its own HTTP API. Notifications are rows in a table. Important actions write a row in `AuditLog`.

## 4b. Build order and prompts (starting from scratch)

Rules:
- **One step at a time.** Claude Code builds only the step it was given and then stops. It never builds several steps, or the whole project, in one go.
- After each step the student runs one `curl` command (or opens the page) and only moves on when it works. He reads and understands the code before the next step.
- **Tests after a whole feature.** Small steps are checked by hand with `curl`. When a whole feature is finished, Claude Code writes tests for it with the built-in `node:test` (no extra package), in `backend/tests/<feature>.test.js`. Features: auth (after step 3), events (after step 7). Tests run with `npm test` against a separate Neon branch (`TEST_DATABASE_URL`), never the real data.
- **Mahmoud's work only.** Claude Code builds only Mahmoud's part: authentication, events (CRUD, clash detection, series, image upload), the organizer pages, and cloud deployment. It does not build or edit Mazen's or Amin's parts.

| Step | Build | Status |
|---|---|---|
| 1 | Repo folders, `backend/package.json` ("type": "module"), packages, `/api/health` | To do |
| 2 | `prisma/schema.prisma`, `src/db/client.js`, first migration, categories migration | To do |
| 3 | Authentication: register, login, me, logout, roles, rate limit | To do |
| 3t | Tests for the auth feature (`backend/tests/auth.test.js`) | To do |
| 4 | Event CRUD for Organizers | To do |
| 5 | Clash detection with alternative slots | To do |
| 6 | Recurring series generator (preview and create) | To do |
| 7 | Image upload (multer + S3) | To do |
| 7t | Tests for the events feature (`backend/tests/events.test.js`) | To do |
| 8 | Organizer pages in React | To do |
| 9 | Capacity advisor and reschedule impact check (Mahmoud's functions, but they need Amin's registration code first) | To do, later |
| 10 | Cloud deployment | To do, later |
| Mazen | Admin module, logging and monitoring, report, threat model | Not part of Mahmoud's work |
| Amin | Student module, registration, database setup, external API | Not part of Mahmoud's work |

Prompts to paste into Claude Code (it already has the rules from `CLAUDE.md`):

**Step 1**
```
Set up the backend. Create backend/package.json with "type": "module" and the scripts dev (node src/server.js), generate and push. Install the backend packages from docs/PROJECT_GUIDE.md section 9b (Prisma pinned to version 7). Create src/app.js that exports makeApp(routes): helmet, cors, json body limit 50kb, trust proxy 1, a GET /api/health route, the given routes, a 404 handler and the error handler. Create src/server.js that calls makeApp and listens on port 3000 (no module routes yet). Create src/shared/errors.js (AppError with status, message, details) and src/shared/middleware/errorHandler.js. Add backend/.env.example. The root .gitignore already covers backend.
```

**Step 2**
```
Create prisma/schema.prisma for the tables in section 7 of docs/PROJECT_GUIDE.md (generator prisma-client, output ./generated, moduleFormat esm, generatedFileExtension ts, importFileExtension ts). Create prisma.config.ts (the datasource url is env("DIRECT_URL") and it imports dotenv/config) and src/db/client.js that exports db() using @prisma/adapter-pg with process.env.DATABASE_URL. The database is Neon: DATABASE_URL is the pooled connection string and DIRECT_URL is the direct one. Add both to backend/.env.example with fake values. Create the first migration 0001_init and a 0002_seed_categories migration (Workshop, Sports, Social, Career, Culture). Show me the exact commands to run.
```

**Step 3**
```
Build the auth module in src/modules/auth (routes, controller, service, schema, password.js) and src/shared/middleware (auth.js with requireAuth and requireRole, validate.js, rateLimit.js). Passwords with scrypt and salt. Session token: random 32 bytes, store only its SHA-256 hash, expires after 8 hours. Public register always makes a Student. Login limited to 10 per minute per IP.
```

**Step 4**
```
Build event CRUD in src/modules/events following section 3 (life cycle) and section 8 (API) of the guide. Organizer only. New events are Pending, Pending and Rejected can be edited, Approved cannot (409), delete rules as written. Validate with zod and refuse < and > in text.
```

**Step 5**
```
Add clash detection in events/clash.service.js as described in section 3, and call it from create and update. A clash answers 409 with the clashing events and alternatives (3 free slots nearest first between 08:00 and 22:00 Cairo time, and free places at the same time). Add POST /api/events/check that saves nothing.
```

**Step 6**
```
Add the recurring series generator (events/recurrence.service.js): preview and create. Frequency DAILY, WEEKLY or MONTHLY, interval, 2 to 20 events, same Cairo clock time across summer and winter time, month end clamp. onClash reject (create nothing) or skip. Save all events in one transaction with one seriesId. Use the clash service for every date.
```

**Step 7**
```
Add image upload: events/upload.js (multer memory storage, 2 MB, field "image") and events/image.service.js (check the file type from its first bytes, JPEG PNG or WebP only, random name, save to S3 with forcePathStyle, keep only the URL, delete the old file when replaced or when the event is deleted). Routes POST and DELETE /api/events/:id/image. Add infra/s3-setup.sh (bucket, public read for events/*, CORS).
```

**Tests (after a whole feature, for example after step 3)**
```
The auth feature is finished. Write tests for it in backend/tests/auth.test.js with node:test and node:assert. Start the app on a free port and call it with fetch. Cover the success cases and the main errors (400, 401, 403, 409, 429). Use TEST_DATABASE_URL. Add an npm test script.
```

**Step 8**
```
Create the React frontend with Vite in frontend/ using the structure in section 10 of the guide: login page, organizer MyEvents page (poster upload, edit, delete), and EventForm (clash check with clickable alternatives, series preview). API address only from VITE_API_URL.
```

## 5. Architecture and cloud services

One Lambda per module. Each module has its own `lambda.js`, which wraps only that module's routes in a small Express app through `serverless-http` (and, where needed, a second handler that reads SQS messages). API Gateway sends `/api/auth/*` to the auth Lambda, `/api/events/*` to the events Lambda, and so on.
On a laptop, `node src/server.js` mounts the routes of every module in one Express app, so local development stays one process.

| Service | Use |
|---|---|
| Neon (serverless PostgreSQL, not an AWS service) | The database. Free plan, hosted on the internet, so it needs no Docker container |
| Lambda | One function per module (auth, events, admin, student, notifications, audit) |
| API Gateway (HTTP API) | Public entry point, one route group per module Lambda |
| SNS | A module announces that something happened (event approved, rescheduled, cancelled) |
| SQS | One queue per listening module, subscribed to SNS, so no message is lost if a Lambda fails |
| EventBridge | Timed jobs (send due reminders, mark past events Completed) |
| S3 | Frontend files and event images |
| IAM | Permissions (each Lambda only gets what it needs) |
| CloudWatch Logs | Logs |
| Secrets Manager | The Neon connection string (`DATABASE_URL`), email key |

Not used (to keep it simple): DynamoDB, ECS, ALB.

Local development uses **Floci**, a free local AWS emulator in Docker, for S3, Lambda, SNS, SQS, EventBridge and the other AWS services. The database is **Neon** from the start, locally and in the cloud, so the laptop needs internet to reach it. Going to real AWS later means changing settings only: keys, API address, bucket name, bucket policy, CORS origin. The database does not change. (Still to ask the TA: is Floci accepted as "cloud deployment"?)

Reminders: an EventBridge schedule starts the reminders Lambda every few minutes. Email goes through the Brevo API (free plan, key in Secrets Manager).

## 6. Security design

- Passwords: scrypt with a salt (Node `crypto`). Never stored in plain text.
- Sessions: a random 32-byte token. Only its SHA-256 hash is stored in the database. Expires after 8 hours.
- Roles checked on every route: 401 when not logged in, 403 for the wrong role.
- Input checked with `zod` (400). Text fields cannot contain `<` or `>`.
- Login rate limit: 10 per minute per IP (429).
- `helmet`, CORS from the `CORS_ORIGINS` environment variable (`*` while developing), `trust proxy` = 1.
- Uploaded images: the type is read from the file's first bytes (JPEG, PNG, WebP only), max 2 MB, random file name.
- Frontend puts server text on the page as plain text, never as HTML.

## 7. Database tables (prisma/schema.prisma)

User, Session, Category, Event, Flag, Registration, SavedEvent, FollowedCategory, Reminder, Notification, AuditLog.
The database is **Neon** (Postgres). Create a free project at neon.tech, then copy two connection strings from the "Connect" button into `backend/.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require"
```

- `DATABASE_URL` is the **pooled** one (its host contains `-pooler`). The running app uses it.
- `DIRECT_URL` is the **direct** one (no `-pooler`). Only Prisma commands (migrate, db push) use it, from `prisma.config.ts`.
- The `src/db/client.js` file keeps using `@prisma/adapter-pg` and `pg`, so no new package is needed.
- Every module Lambda imports the same `db/client.js`. The bundler copies it into each Lambda.
- Neon can pause the database after a few minutes without use, so the first request after a pause is slow (about one second). This is normal.
- Never put the connection strings in git. They contain the password. `.env.example` has fake values only.

The schema is a shared file, Amin owns it. Any change goes through a pull request that all three review.

## 8. API (to build)

| Method and path | Who | What |
|---|---|---|
| POST `/api/auth/register` | public | Creates a Student |
| POST `/api/auth/login` | public | Returns `{ token, user }` |
| GET `/api/auth/me` | logged in | Who am I |
| POST `/api/auth/logout` | logged in | Ends the session |
| GET `/api/events/categories` | Organizer, Admin | Active categories |
| GET `/api/events/mine` | Organizer | My events |
| POST `/api/events/check` | Organizer | Is this place and time free? Saves nothing |
| POST `/api/events` | Organizer | Create (409 on clash, with alternatives) |
| GET `/api/events/:id` | Organizer (owner), Admin | One event |
| PATCH `/api/events/:id` | Organizer (owner) | Edit a Pending or Rejected event |
| DELETE `/api/events/:id` | Organizer (owner) | Delete or cancel |
| POST `/api/events/series/preview` | Organizer | Dates of a repeating series and which are free |
| POST `/api/events/series` | Organizer | Create the series (`onClash`: `reject` or `skip`) |
| POST `/api/events/:id/image` | Organizer (owner) | Upload a poster (multipart, field `image`) |
| DELETE `/api/events/:id/image` | Organizer (owner) | Remove the poster |
| GET `/api/health` | public | `{ status: "ok" }` |

Errors always look like `{ "error": "message" }`, clash errors add `clashes` and `alternatives`.

## 9. Project structure

```
campus-events-calendar/
├── CLAUDE.md                          the prompt from section 11
├── README.md
├── .gitignore
├── docs/                              this guide, report, diagrams
├── evidence/                          screenshots for the report
│
├── infra/
│   ├── env.sh                         points the aws command to Floci
│   ├── s3-setup.sh                    creates the image bucket
│   ├── messaging-setup.sh             SNS topic, SQS queues, subscriptions, EventBridge schedules
│   └── floci/docker-compose.yml       starts Floci
│
├── frontend/                          React (see section 10)
│
└── backend/
    ├── package.json                   "type": "module"
    ├── prisma.config.ts               the only Prisma file outside prisma/
    ├── .env  (not in git)   .env.example
    │
    ├── prisma/
    │   ├── schema.prisma              shared, Amin owns it
    │   ├── generated/                 made by prisma generate (not in git)
    │   └── migrations/                0001_init, 0002_seed_categories
    │
    ├── tests/                         auth.test.js, events.test.js (one file per finished feature)
    ├── scripts/                       createUser.js (one-time: make an Organizer or Admin)
    │
    └── src/
        ├── server.js                  runs on the laptop: mounts every module's routes
        ├── app.js                     makeApp(routes): helmet, cors, json, routes, 404, error handler
        ├── db/client.js               the one Prisma client: import { db }
        ├── shared/
        │   ├── config.js  errors.js
        │   ├── messaging.js           publish a message to SNS
        │   └── middleware/            auth.js  validate.js  rateLimit.js  errorHandler.js
        └── modules/
            ├── auth/                  lambda, routes, controller, service, schema, password
            ├── events/                lambda, routes, controller, service, schema,
            │                          clash.service, recurrence.service, upload, image.service,
            │                          capacity.service, reschedule.service
            ├── admin/                 Mazen: lambda, review, trust, flags, categories, lifecycle
            ├── student/               Amin: lambda, saved, registration, reminders, digest, recommend
            ├── notifications/         lambda, notifications.service, email.service
            └── audit/                 lambda, audit.service
```

Every module folder follows the same pattern:
`lambda` (the module's Lambda entry) -> `routes` (URLs and roles) -> `controller` (reads the request, sends the answer) -> `service` (the business rules) -> `schema` (zod checks).
Rules live only in the service. A controller never contains rules. `lambda.js` contains no rules either: it only builds the app with `makeApp(moduleRoutes)` and exports the handler (plus a queue handler if the module listens to SQS).

## 9b. Backend packages

Install from the `backend` folder.

Runtime:
```
npm install express cors helmet express-rate-limit zod serverless-http multer @aws-sdk/client-s3 pg dotenv
npm install @aws-sdk/client-sns @aws-sdk/client-sqs @aws-sdk/client-eventbridge
npm install @prisma/client@7 @prisma/adapter-pg@7
npm install date-fns date-fns-tz rrule
```

Development:
```
npm install -D prisma@7 esbuild
```

| Package | Why |
|---|---|
| express | The web server |
| cors | Lets the browser page call the API |
| helmet | Safe HTTP headers |
| express-rate-limit | Stops password guessing |
| zod | Checks the data of every request |
| serverless-http | Runs the Express app inside Lambda |
| multer | Reads uploaded files (kept in memory, no disk) |
| @aws-sdk/client-s3 | Saves and deletes images in S3 |
| @aws-sdk/client-sns, client-sqs, client-eventbridge | Publish messages, read queues, create schedules |
| pg and @prisma/adapter-pg | Prisma 7 talks to Postgres without a binary engine |
| @prisma/client and prisma (both version 7) | Database access and the schema tool |
| dotenv | Loads `backend/.env` |
| date-fns, date-fns-tz, rrule | Date helpers (the series generator uses the built-in `Intl` for Cairo time) |
| esbuild | Bundles each module's `lambda.js` into one file per Lambda |

Always pin Prisma to version 7 (`@prisma/client@7`, `@prisma/adapter-pg@7`, `prisma@7`). Version 8 breaks the setup.
Built-in Node modules (`node:crypto`, `node:test`, `node:assert`) need no install. Tests use `node:test` and `node:assert` and are written only after a whole feature is finished.

## 10. Frontend: React structure and packages

All three user areas are built in React with Vite (there is no old frontend: we start from scratch).

Create it (from the repo root):
```
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-router-dom
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
npm install date-fns date-fns-tz
```

| Package | Why |
|---|---|
| react, react-dom | The UI library (comes with Vite) |
| vite, @vitejs/plugin-react | Dev server and build (comes with the template) |
| react-router-dom | Pages and links (login, organizer, admin, student) |
| @fullcalendar/* | The shared calendar view for students |
| date-fns, date-fns-tz | Showing dates in Cairo time |

No axios, no Redux, no UI framework: plain `fetch` and React's own `useState` and `useEffect` are enough and easier to explain.

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── .env                         VITE_API_URL=http://localhost:3000/api
└── src/
    ├── main.jsx                 starts React, wraps the app in the router
    ├── App.jsx                  the routes
    ├── api/
    │   └── api.js               fetch helper: adds the token, throws readable errors
    ├── auth/
    │   ├── AuthContext.jsx      who is logged in (user, login, logout)
    │   └── RequireRole.jsx      blocks a page for the wrong role
    ├── components/
    │   ├── Header.jsx
    │   ├── Message.jsx          error / success / info box
    │   ├── EventCard.jsx
    │   └── StatusBadge.jsx
    ├── pages/
    │   ├── Login.jsx
    │   ├── organizer/
    │   │   ├── MyEvents.jsx     list with poster buttons
    │   │   ├── EventForm.jsx    create / edit, clash check, series preview
    │   │   └── Alternatives.jsx clickable free slots and places
    │   ├── admin/               Mazen: ReviewQueue.jsx, Categories.jsx
    │   └── student/             Amin: Calendar.jsx, SavedEvents.jsx
    └── styles/
        └── style.css
```

Frontend rules:
- The API address comes from `import.meta.env.VITE_API_URL`, nowhere else.
- The login token is kept in `sessionStorage`.
- Text from the server is rendered as normal JSX text (React escapes it). Never use `dangerouslySetInnerHTML`.
- Form dates use `<input type="datetime-local">` and are sent to the API as ISO text (`new Date(value).toISOString()`).
- For the cloud, `npm run build` creates `dist/`, which is uploaded to the S3 bucket.

## 11. Prompt for Claude Code (copy into CLAUDE.md)

```
# Project: Campus Events Calendar (university group project, Intro to Cloud)

You are helping a student. Read docs/PROJECT_GUIDE.md first. It explains the project,
the roles, the event rules, the API, the structure and the packages.

## Language and module type
- JavaScript with ES modules. backend/package.json has "type": "module".
- Use `import` and `export`. NEVER use `require`, `module.exports` or `exports.x`.
- Relative imports must end with `.js`, for example: import { db } from '../../db/client.js';
- Node built-ins use the node: prefix, for example: import crypto from 'node:crypto';
- No TypeScript. The frontend uses React with JSX.

## The student must understand every line
The university allows AI-written code only if the student understands it. So:
- Write PRIMITIVE, BEGINNER-LEVEL code. Simple and boring is the goal. It must get the job done, nothing more.
- Use plain functions, `const`, `if`, `for` loops, `async` and `await`. Prefer a plain `for` loop over clever chains of map, filter and reduce.
- No design patterns, no classes (except the existing AppError), no generics, no decorators, no dependency injection frameworks, no clever one-liners, no premature optimisation.
- Do not add new packages. Use only the packages listed in docs/PROJECT_GUIDE.md. If something truly needs a new package, stop and ask first.
- Keep functions short (about 30 lines). One function does one thing. Give variables full, clear names.
- Do NOT add comments to the code. No `//` lines, no `/* */` blocks, no JSDoc. The code must explain itself through clear names.
- Do not refactor or rename code that was not part of the request. Do not touch other members' modules.

## Git: never commit
- Do NOT run `git commit`, `git push`, `git add`, `git merge` or any command that changes git history or the remote.
- Do not create branches or pull requests. Only edit files. The student makes every commit himself.
- You may read git state (`git status`, `git diff`, `git log`) when it helps.

## Structure rules (backend)
- Every module folder (auth, events, admin, student, notifications, audit) has: lambda, routes, controller, service, schema.
- Every module is its own Lambda. lambda.js only builds the app with makeApp(moduleRoutes) from src/app.js and exports the handler (plus a queue handler if the module reads SQS). No rules in lambda.js.
- src/server.js is for the laptop only: it mounts the routes of every module in one app.
- routes = URLs and roles. controller = reads req, sends res, no rules. service = the business rules and database calls. schema = zod checks.
- Need an answer now: import the other service and call it. Tell another module something happened: publish a message with src/shared/messaging.js (SNS, then SQS). Timed jobs use EventBridge.
- The database is used ONLY through `import { db } from '../../db/client.js'` and then `db().tableName.method(...)`.
- Throw `new AppError(status, 'clear message', optionalDetails)` for expected errors. The error handler turns it into JSON `{ error }`.
- Functions must interact: a service calls another module's service (import it and call it). Do not make plain CRUD only.
- Do not edit prisma/schema.prisma without being asked. It is a shared file.

## Security rules
- Every route except register, login and health needs requireAuth. Add requireRole where only some roles may use it.
- Check every request body with zod (validate middleware). Never trust input.
- Never store or log passwords or tokens. Never build SQL by hand.
- Show server text as plain text in the frontend, never as HTML.

## Tests only after a whole feature
- During a step, do NOT write tests. The student checks each step by hand with curl or in the browser.
- When a whole feature is finished (auth after step 3, events after step 7), write its tests in backend/tests/<feature>.test.js when the student asks.
- Use only node:test and node:assert (no new test packages). Start the app on a free port and call it with fetch. No fake databases: use TEST_DATABASE_URL (a separate Neon branch).
- Tests follow the same simple style: plain functions, clear names, no comments.

## Work step by step
- Build ONLY the step the student asked for. Then stop and wait. Never build several steps, or the whole project, at once.
- If a step needs something from a later step, say so and stop. Do not build it ahead of time.

## Scope: Mahmoud's work only
- You build only Mahmoud's part: authentication, events (CRUD, clash detection, recurring series, image upload), the organizer pages, and cloud deployment.
- Do NOT create or edit anything in src/modules/admin, src/modules/student, src/modules/notifications or src/modules/audit, and do not build Mazen's or Amin's pages. Leave them empty.
- If a change is needed in a shared file (prisma/schema.prisma, errors, middleware), say what is needed and ask before touching it.

## Frontend (React + Vite)
- Function components and hooks only (useState, useEffect). No Redux, no axios, no UI framework.
- API address only from import.meta.env.VITE_API_URL. All requests go through src/api/api.js.
- One page per file in src/pages, small reusable parts in src/components.

## How to answer
- First say in 2 or 3 simple sentences what you will change, then do it.
- After the change, list the files you touched and give one exact curl command (or the page to open) so the student can check it by hand.
- Explain anything non-obvious in your answer (in simple words, as if to a beginner), not as comments in the code.
- Finish by suggesting a commit message the student can use. Do not run the commit.
```

## 12. How to run it locally

These steps work once the steps in section 4b are built. Before step 2, put your two Neon connection strings in `backend/.env` (section 7).

```
# 1. Floci for S3 (Docker Desktop must be open), from the repo root
docker compose -f infra/floci/docker-compose.yml up -d
source infra/env.sh
bash infra/s3-setup.sh                 # once: creates the image bucket

# 2. Backend, from the backend folder
npm install
npx prisma generate
npx prisma migrate deploy              # creates the tables and the categories in Neon (uses DIRECT_URL)
source ../infra/env.sh
npm run dev                            # keep this terminal open

# 3. Frontend, from the frontend folder
npm run dev                            # opens http://localhost:5173
```

Test with curl in a second terminal:
```
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"organizer@campus.test","password":"YOUR_PASSWORD"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
curl -s http://localhost:3000/api/events/mine -H "Authorization: Bearer $TOKEN"
```
Restart the backend after every code change (there is no hot reload). A fresh database has no users. Sign up makes a Student. To test the Organizer and Admin roles, create them with a small one-time SQL insert or a one-time script (a hashed password is required, so ask Claude Code to write it). Local passwords are for development, never for real use.

## 13. Git routine

- Claude Code never commits, pushes or opens pull requests. The student runs every git command himself.
- One branch per member: `mahmoud/event-submission`, `mazen/event-approval`, `amin/student-calendar`.
- `git add .`, `git commit -m "short message"`, `git push`, then a pull request into `main` reviewed by another member.
- Run `npm test` before every pull request once the feature has tests.
- Never commit `.env`, `node_modules`, `prisma/generated` or zip files.
- Build and commit one step at a time: one step, one check, one commit.
- When a shared file changes (schema, errors, middleware), tell the other two members.

## 14. Open questions

- Ask the TA: is Floci accepted as cloud deployment? Is it fine that functions trigger across members?
- Neon is not an AWS service. Ask the TA whether an external database is accepted for the cloud deployment (the other services stay on AWS).
- Check that Lambda on Floci can reach the internet (Neon) and that image upload works through API Gateway as binary.
- Check that Floci supports SNS to SQS subscriptions, SQS triggers for Lambda, and EventBridge schedules.
- Agree with Mazen and Amin on the message names and their contents (for example `event.approved`, `event.rescheduled`, `event.cancelled`).
- Create a second Neon branch for tests and put its connection string in `TEST_DATABASE_URL`.
- The Lambda build command must be changed to produce an ES module (do it at deployment time).
- Decide how the first Admin and Organizer are created, locally and in the cloud (sign-up only makes Students).
