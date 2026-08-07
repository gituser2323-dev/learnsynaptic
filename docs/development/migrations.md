# Database Migrations & Backfills

**Status: current.**

---

## 1 · Migration process

`lib/db/migrations/index.ts` exports a `migrations: Migration[]` array
— each entry an idempotent, transactional `up` function. Applied
migration ids are recorded in a `_migrations` collection; a migration
already recorded is skipped, never re-applied. Each migration's `up`
runs inside `runInTransaction()`, so a failure partway through never
leaves data half-migrated (real-MongoDB transaction; degrades to a
no-op session against the in-memory store, matching every other
transactional write in this codebase).

**Deliberately separate from application startup** — nothing in
`instrumentation.ts` or any request path calls `runPendingMigrations()`.
This is an explicit architectural rule (RC-4): DATA MIGRATION is never
triggered implicitly by a deploy or a cold start.

### How to run

```bash
npm run db:migrate
```

Safe to run repeatedly (skips anything already recorded) and safe to
run against an empty `migrations` array (the common case — exits
immediately with nothing to do). Requires a real `MONGODB_URI`.

### How to verify

Check the script's own console output (reports which migrations ran,
if any) and, for anything touching a specific collection, spot-check a
few documents directly (`mongosh`) before/after.

## 2 · Index sync

Not part of `runPendingMigrations()` — a **separate** deliberate step,
because index creation on a large collection has real, avoidable
production cost (lock contention, latency) that shouldn't happen
implicitly on every boot. `autoIndex` is disabled in production;
`npm run db:sync-indexes` imports every model and calls
`syncIndexes()` on each — run it deliberately after a deploy that
changes an index definition, never assumed to run automatically.

## 3 · Backfill scripts

`scripts/backfill*.ts` — one-off scripts for populating a new field on
existing documents (e.g. `Opportunity.stageHistory`,
`Organization.organizationId` on legacy records). None are
transactional; all are safe to re-run after being killed mid-way, since
each is a filter-then-write pattern (finds documents missing the
field, writes it) rather than a checkpoint mechanism — re-running
simply finds fewer documents left to touch. Run with:

```bash
npx tsx --env-file=.env.local scripts/backfillXxx.ts
```

Read the specific script's own doc comment before running — several
document a real, disclosed approximation (e.g.
`backfillOpportunityStageHistory.ts` only backfills a document's
*current* stage, not its full historical transitions, since that
history was never captured before the field existed).

## 4 · Failure handling

- **Migration fails partway through** — the transaction rolls back;
  nothing partially applies. Fix the migration code, re-run
  `npm run db:migrate` — the failed migration was never recorded, so
  it retries from the start.
- **Backfill script killed mid-run** — safe to re-run (see §3); no
  transaction, no rollback needed, because the filter-then-write
  pattern is idempotent by construction.
- **Index sync fails** — `syncIndexes()` reports per-model errors;
  fix the offending schema/index definition and re-run. Never run
  `db:sync-indexes` against a large production collection without a
  maintenance window if the change involves dropping/rebuilding a
  large index — `syncIndexes()` can drop indexes not in the current
  schema definition, which is real and intentional (keeps indexes in
  sync with code) but worth knowing before running blind.

## 5 · Production rules — what NOT to do

- Never wire `runPendingMigrations()` into `instrumentation.ts` or any
  request path, even for "convenience" — this is a deliberate,
  disclosed architectural boundary (RC-4), not an oversight to fix.
- Never run `db:sync-indexes` automatically on every deploy for the
  same reason.
- Never run a destructive migration (dropping a field/collection) in
  the same deploy window as the code that stops reading it — this
  codebase's own convention is additive-only within one deploy window;
  remove the old field/collection in a **later**, separate deploy once
  the new code has been live and verified.
- A restore from backup should always run `db:sync-indexes` afterward
  if any index changed since the backup was taken — see
  [`DR_RUNBOOK.md`](../../DR_RUNBOOK.md) for the full restore
  checklist.
