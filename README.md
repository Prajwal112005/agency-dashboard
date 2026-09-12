# Control Room — Real-Time Client Project Dashboard

A role-based project/task tracker for a small agency, built around a live,
role-filtered activity feed. Admin/PM/Developer see different data and
different UI, but every permission is enforced on the API — the frontend
only decides what to *render*, never what to *allow*.

```
agency-dashboard/
├── backend/     Express + TypeScript API, Prisma/PostgreSQL, Socket.io, node-cron
├── frontend/    React + TypeScript (Vite)
└── docker-compose.yml
```

## 1. Local setup

### Option A — Docker (preferred)

```bash
docker compose up --build
```

This starts Postgres, runs the backend (which applies checked-in Prisma migrations on boot),
and serves the frontend. Then seed the database once the containers are up:

```bash
docker compose exec backend npm run seed
```

- Frontend: http://localhost:5173
- API: http://localhost:4000

### Option B — Manual

Requires Node 20+ and a local PostgreSQL instance.

```bash
# 1. Backend
cd backend
cp .env.example .env          # edit DATABASE_URL if needed
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev                   # http://localhost:4000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

### Seed accounts (password for all: `Password123!`)

| Role      | Email(s) |
|-----------|----------|
| Admin     | admin@agency.dev |
| PM        | priya.pm@agency.dev, marcus.pm@agency.dev |
| Developer | ravi.dev@agency.dev, sofia.dev@agency.dev, wei.dev@agency.dev, amara.dev@agency.dev |

Seed data includes 3 projects, 5–6 tasks each, at least two already-overdue
tasks, and pre-populated activity/notification history so the feed and
bell aren't empty on first login.

## 2. Database schema

```
User (id, email, passwordHash, name, role[ADMIN|PM|DEVELOPER])
 ├── managedProjects  → Project.managerId
 ├── assignedTasks    → Task.assignedToId
 ├── activityEvents   → ActivityLog.actorId
 ├── notifications    → Notification.userId
 └── refreshTokens    → RefreshToken.userId

Client (id, name, contactEmail)
 └── projects → Project.clientId

Project (id, name, description, clientId → Client, managerId → User)
 ├── tasks      → Task.projectId
 └── activities → ActivityLog.projectId

Task (id, projectId → Project, title, description, assignedToId → User,
      status[TODO|IN_PROGRESS|IN_REVIEW|DONE],
      priority[LOW|MEDIUM|HIGH|CRITICAL], dueDate, isOverdue)
 ├── activities    → ActivityLog.taskId
 └── notifications → Notification.taskId

ActivityLog (id, taskId → Task, projectId → Project, actorId → User,
             oldStatus, newStatus, createdAt)   -- append-only audit trail

Notification (id, userId → User, type[TASK_ASSIGNED|TASK_IN_REVIEW],
              message, taskId → Task, isRead, createdAt)

RefreshToken (id, token, userId → User, expiresAt, revoked)
```

Full definition with relations: [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma).

### Indexing decisions

- Every foreign key is indexed (`Project.managerId`, `Project.clientId`,
  `Task.projectId`, `ActivityLog.taskId`, `Notification.taskId`, etc.) since
  nearly every query joins through one.
- `Task(assignedToId, status)` — composite index for the Developer
  dashboard's core query ("my open tasks").
- `Task(status)`, `Task(priority)`, `Task(dueDate)`, `Task(isOverdue)` —
  indexed individually because `/tasks` is filtered by any combination of
  these via URL query params.
- `ActivityLog(projectId, createdAt)` — supports both "latest feed for this
  project" and the "give me everything since timestamp X" catch-up query in
  one index, since both filter on `projectId` and sort/range on `createdAt`.
- `Notification(userId, isRead)` — the unread-count badge query runs on
  almost every page load and socket reconnect.

## 3. Architectural decisions

### Backend framework — Express

Chosen over Fastify for this project because the team is more likely to be
evaluated on the three actually-hard requirements (authz, WebSockets,
background jobs) than on raw HTTP throughput. Express's ubiquity means every
middleware pattern here (auth, validation, error handling) is unsurprising
to read, and its ecosystem has first-class `socket.io` and `cookie-parser`
support with no adapter layer. Fastify's schema-based validation and higher
raw throughput are real advantages, but they matter most at a request
volume this app is not attempting to demonstrate.

### WebSocket library — Socket.io

Chosen over a native `ws` WebSocket server for three concrete reasons this
app relies on:

1. **Rooms.** The role-filtered feed uses `project:<id>` rooms for Admin/PM
   project viewers, `task:<id>` rooms for Developer task activity, and
   `user:<id>` rooms for per-user notifications. Native WebSocket has no
   concept of rooms — reimplementing these broadcast groups by hand is
   exactly the kind of undifferentiated code Socket.io already solves.
2. **Automatic reconnection with backoff**, which is what makes the
   "offline user comes back and catches up" flow reliable — the client
   knows precisely when it reconnected (`socket.on("connect", ...)`) and
   uses that moment to hit the DB-backed catch-up endpoint.
3. **A handshake step for auth.** `io.use()` lets the JWT be verified
   once per connection, consistently with the REST API's `authenticate`
   middleware, before any room joins happen.

The trade-off is a slightly heavier client bundle and a non-standard wire
protocol versus raw WebSocket — acceptable here since both ends of the
connection are code in this repo, not a public wire-format contract.

### Background jobs — node-cron (not BullMQ)

The only background job in this app is a single, stateless, idempotent
sweep: *"flip `isOverdue = true` for any task whose due date has passed and
isn't already flagged or Done."* It runs on a fixed schedule, has no
per-job payload, needs no retry/backoff semantics, and doesn't need to be
distributed across multiple worker processes.

BullMQ earns its complexity when you need a durable **queue** — jobs
enqueued dynamically at request time, retried with backoff, processed by a
pool of workers pulling from Redis. None of that applies to a five-line
periodic sweep, and pulling in Redis purely to schedule it would be
infrastructure the app doesn't need. If this product grew a feature like
"queue a reminder email per assignment" or "generate a PDF report on
demand," BullMQ would be the right tool for *that*, run alongside the cron
— not a replacement for it.

### Token storage — access token in memory, refresh token in an HttpOnly cookie

- The **access token** (short-lived JWT, 15 min) lives only in a
  module-level JS variable on the frontend (`frontend/src/lib/api.ts`).
  It is never written to `localStorage` or a JS-readable cookie, so it
  isn't a target for XSS-based exfiltration. Its cost is that it's lost on
  a hard refresh — traded off deliberately against the security benefit.
- The **refresh token** is an opaque random string. Only its SHA-256 hash is
  stored server-side in the `RefreshToken` table, and the raw token is sent
  to the browser only inside an `HttpOnly`, `SameSite=Lax` cookie scoped to
  `/api/auth`.
  JavaScript can never read it. On page load, the frontend calls
  `/api/auth/refresh` once to silently re-establish a session from that
  cookie. Every refresh **rotates** the token (old one is marked revoked,
  a new one issued), limiting the blast radius of a stolen cookie.
- The `axios` response interceptor retries any request that comes back
  `401` exactly once, after transparently refreshing — so an expired
  access token never surfaces as a user-visible error mid-session.
- Authorization itself never trusts anything from the frontend: every
  protected route re-derives the caller's identity and role from the
  verified JWT (`req.user`, set by `authenticate` middleware), and
  ownership (a PM's own projects, a Developer's own tasks) is re-checked
  against the database on every request — see `assertProjectAccess` in
  `backend/src/routes/projects.ts`, reused by the task routes.

### Real-time role-filtered feed — how it works end to end

1. On connect, the Socket.io handshake verifies the same JWT the REST API
   uses and sets `socket.user`.
2. Every socket auto-joins a personal `user:<id>` room (used for
   notifications). Developers also join `task:<taskId>` rooms for their
   currently assigned tasks. Admins join a single `admin:activity` firehose
   room. PMs and Admins can additionally join a project room while viewing it.
3. When a PM or Admin opens a specific project page, the client explicitly
   asks to `join:project`, and the server re-checks ownership
   (`canAccessProject`) before allowing the join — so a PM cannot join
   another PM's room by guessing an id.
4. A status change writes an immutable row to `ActivityLog` first, then
   emits `activity:new` to the project room, the affected task room, and the
   Admin firehose. Developers therefore receive only activity for tasks
   currently assigned to them; the broadcast payload is the exact row that
   was just persisted.
5. If a client was offline, it doesn't miss anything: on `connect` (initial
   or reconnect) it calls `GET /api/activity?since=<last seen timestamp>`,
   which reads straight from `ActivityLog` — never from server memory —
   and merges anything missed into the feed. This also covers the literal
   spec requirement of "last 20 missed events from the database."

## 4. Known limitations

- No password-reset / email-verification flow — out of scope for this
  assignment.
- Admins can transfer an existing project's manager from the project editor;
  PMs can only manage projects they own, and Developers cannot manage projects.
- Admin cannot change a user's role while that user owns projects or is
  assigned to tasks; the existing relationships must be reassigned first.
- Notification types are limited to the two the spec calls for
  (assignment, moved-to-review); there's no per-user notification
  preferences.
- The overdue sweep runs on a fixed interval (`OVERDUE_CRON`, default every
  5 minutes) rather than being scheduled precisely at each task's due
  instant — an acceptable trade-off for this scale, called out explicitly
  since it's the kind of shortcut that's easy to take silently.
- Automated tests are not included in this submission; the main security
  and real-time paths are implemented server-side and should be exercised
  with integration tests before production use.
- Rate limiting / brute-force protection on `/auth/login` is not
  implemented.

## 5. Explanation (for submission)

**The hardest problem** was making the real-time feed both role-filtered
and reliable across disconnects, without duplicating the access-control
logic that already exists for the REST API. I solved it by treating
Socket.io rooms as a mirror of the same ownership rules the REST routes
enforce (`assertProjectAccess`/`canAccessProject`), and by never trusting
server memory as a source of truth — every broadcast payload is the exact
row just written to `ActivityLog`, and every reconnect triggers a DB read
for anything missed since the client's last-seen timestamp, so a page
refresh, a sleeping laptop, or a server restart can never silently drop an
event. **For the role-filtered feed** specifically: Developers auto-join
rooms for their own tasks' projects, PMs/Admins join on demand with a
server-side ownership check, and Admins get one firehose room instead of
joining every project — keeping the fan-out cheap as the number of
projects grows. **One thing I'd do differently**: move the overdue sweep
and activity fan-out behind a small internal event bus now, so that adding
email or Slack notifications later wouldn't mean touching the WebSocket
code directly.
