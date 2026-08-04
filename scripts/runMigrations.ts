import { runPendingMigrations } from "@/lib/db";

/**
 * RC-4 — Deployment & Production Infrastructure.
 *
 * `runPendingMigrations()` (lib/db/migrations/index.ts) has existed
 * since the original schema-migration scaffold — idempotent (records
 * applied ids in a `_migrations` collection, skips anything already
 * there), transactional (each migration's `up` runs inside
 * `runInTransaction()`, so a failure partway through never leaves data
 * half-migrated) — but had ZERO callers anywhere in the app. This is
 * the real, explicit, operator-triggered entry point: DATA MIGRATION
 * is deliberately separate from APPLICATION STARTUP (this mission's
 * own explicit instruction) — nothing in `instrumentation.ts` or any
 * request path calls this. Run it yourself, once, after deploying code
 * that adds a new entry to the `migrations` array, before (or
 * immediately after) that code goes live — never automatically on
 * every boot, which would mean re-checking (and risking re-running) a
 * migration on every cold start for no benefit.
 *
 * Usage:
 *   npm run db:migrate
 *
 * Safe to run repeatedly — a migration already recorded in
 * `_migrations` is skipped, not re-applied. Safe to run against an
 * empty `migrations` array (the common case for most deploys) — this
 * script exits immediately with nothing to do.
 */
async function main(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set — nothing to migrate against. This script only makes sense against a real MongoDB.");
    process.exitCode = 1;
    return;
  }

  console.log("Running pending migrations...");
  await runPendingMigrations();
  console.log("Done — every migration is either newly applied or was already recorded as applied.");
}

main().catch((error) => {
  console.error("Migration run failed:", error);
  process.exitCode = 1;
});
