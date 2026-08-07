# Local Development Guide

**Status: current.** Every command below is a real script in
`package.json` — none of this is aspirational. Follow in order.

---

## 1 · Clone & install

```bash
git clone <repo-url>
cd learnsynaptic-main
npm install
```

Node `>=22.0.0` (see `package.json`'s `engines` field).

## 2 · Environment

```bash
cp .env.example .env.local
```

**Every value may stay blank.** The app is designed to run with zero
configuration for local development — see
[`environment.md`](environment.md) and `lib/startupValidation.ts`. If
you want real persistence, real WhatsApp/Email/AI providers, or to
exercise RC-7's onboarding funnel with real verification emails, fill
in the relevant section of `.env.local` (real values, per
[`environment.md`](environment.md)'s section index).

## 3 · MongoDB (optional for basic dev, required for real persistence)

Unset `MONGODB_URI` → the app runs against an in-memory repository per
process (data does not persist across restarts, not shared across
concurrent instances). This is enough for browsing the marketing site,
most UI work, and the unit test suite.

To run against a real local MongoDB replica set (needed for any
feature that spans multiple requests with real persisted state, and
for anything a `runInTransaction()` call depends on):

```bash
mkdir -p .mongo-data
mongod --port 27117 --dbpath .mongo-data --replSet rs-learnsynaptic --bind_ip 127.0.0.1 &
mongosh --port 27117 --eval 'rs.initiate({_id: "rs-learnsynaptic", members: [{_id:0, host:"localhost:27117"}]})'
```

Then set in `.env.local`:

```
MONGODB_URI=mongodb://127.0.0.1:27117/learnsynaptic?replicaSet=rs-learnsynaptic
```

The replica-set name in your `mongod --replSet` flag and the
`replicaSet=` query param in `MONGODB_URI` **must match exactly** — a
mismatch fails with `MongooseServerSelectionError`, not a clear "name
doesn't match" error.

## 4 · Queue / worker

**Nothing to run separately.** This app's queue is a MongoDB-backed
scheduler drained by a real HTTP route
(`GET /api/cron/run-due-jobs`) — see
[`docs/architecture/overview.md`](../architecture/overview.md#4--cross-cutting-concerns).
In local dev, trigger it manually from the admin UI ("Run Due Jobs
Now" on `/admin/reliability`) or curl it directly:

```bash
curl "http://localhost:3000/api/cron/run-due-jobs" -H "Authorization: Bearer $CRON_SECRET"
```

(only works if `CRON_SECRET` is set in `.env.local`).

## 5 · Seed / bootstrap an account

Two real ways to get a working account, pick one:

**A — self-service registration (recommended, exercises the real
product path):**

1. `npm run dev`, open `http://localhost:3000/admin/register`.
2. Register with any email/password. With no real email provider
   configured, the verification email is logged to the dev server's
   own console (`[email:console] -> ...` — the link is right there in
   the terminal output).
3. Open the logged `/admin/verify-email?token=...` link.
4. You land in the onboarding wizard (`/admin/onboarding`) — create an
   organization, and you're a real tenant Admin.

**B — CLI bootstrap (skips email verification, useful for scripted
setup):**

```bash
npx tsx --env-file=.env.local scripts/createAdminUser.ts you@example.com "SomePassword123" admin "Your Name"
```

Requires a real `MONGODB_URI` (§3) — against the in-memory store, the
created user vanishes when the script's process exits. See that
script's own doc comment for when to prefer it over registration.

**Platform Super Admin** (RC-6) is never grantable through either path
above — CLI-only, on a pre-existing account:

```bash
npm run platform:bootstrap-super-admin -- you@example.com
```

## 6 · Run

```bash
npm run dev
```

`http://localhost:3000` — marketing site at `/`, admin app at
`/admin`.

## 7 · Log in

`http://localhost:3000/admin/login` with whichever account you created
in step 5.

## 8 · Test

```bash
npm run test:unit      # Vitest — no external dependencies needed
npm run test:e2e       # Playwright — spins up its own server + in-memory store
```

Full breakdown: [`testing.md`](testing.md).

## 9 · Common local-dev gotchas

- **`npx tsx scripts/*.ts` does not auto-load `.env.local`** the way
  `npm run dev`/`next build` do — pass `--env-file=.env.local`
  explicitly, or the script sees an empty `MONGODB_URI` and silently
  runs against a process-local in-memory store.
- **A Mongoose schema edit does not take effect via Fast Refresh** —
  `mongoose.models.X` is a process-level singleton created on first
  import. After editing anything in `lib/db/models/*.model.ts`, fully
  restart `npm run dev` (kill + start again), not just wait for HMR.
- **A script that connects to MongoDB but never calls
  `process.exit()`** keeps the Node process alive after it's actually
  finished — this looks like a hang if you pipe its output through
  `tail` with a timeout; redirect to a file instead if a script seems
  stuck.
