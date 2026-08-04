import { readdir } from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";

/**
 * RC-4 — Deployment & Production Infrastructure.
 *
 * Mongoose's own `autoIndex` (on by default) would otherwise attempt
 * `createIndex()` for every model on every single connection — meaning
 * every cold start in production. That's real, avoidable latency on
 * the hot path, non-trivial lock contention against a large production
 * collection, and — per this mission's own explicit "do NOT
 * automatically create destructive indexes/migrations during every
 * production boot" instruction — the wrong place for a schema-affecting
 * operation to run implicitly. `lib/db/connection.ts` now disables
 * `autoIndex` whenever `NODE_ENV==="production"` (see that file's own
 * doc comment); THIS script is the real, explicit, operator-triggered
 * replacement — run once after a deploy that actually changed an index
 * definition, not on every boot.
 *
 * Every `*.model.ts` file registers its own model as a side effect of
 * being imported (`models.X || model<...>("X", schema)`) — importing
 * all of them here is what populates `mongoose.models` before this
 * script calls `syncIndexes()` on each. `syncIndexes()` (not
 * `createIndexes()`) is deliberate: it also DROPS any index that no
 * longer exists in the current schema, keeping the real database
 * exactly in sync with what the code declares — printed per-model so a
 * drop is visible, never silent.
 *
 * Usage:
 *   npm run db:sync-indexes
 *
 * Safe to run against a database with existing data — MongoDB's own
 * `createIndex`/`dropIndex` are online operations (may briefly affect
 * query performance on very large collections while building, but
 * never take the collection offline). Review the printed per-model
 * output before running against production for the first time; a
 * dropped index that a running query still depends on is a real
 * performance regression, not a correctness one.
 */
async function importAllModels(): Promise<void> {
  const modelsDir = path.join(process.cwd(), "lib/db/models");
  const files = (await readdir(modelsDir)).filter((f) => f.endsWith(".model.ts"));
  for (const file of files) {
    await import(`../lib/db/models/${file.replace(/\.ts$/, "")}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set — nothing to sync. This script only makes sense against a real MongoDB.");
    process.exitCode = 1;
    return;
  }

  await importAllModels();
  await getConnection();

  const modelNames = Object.keys(mongoose.models).sort();
  console.log(`Syncing indexes for ${modelNames.length} model(s)...\n`);

  for (const name of modelNames) {
    const model = mongoose.models[name];
    try {
      const result = await model.syncIndexes();
      if (result.length > 0) {
        console.log(`  ${name}: dropped/rebuilt ${result.join(", ")}`);
      } else {
        console.log(`  ${name}: up to date`);
      }
    } catch (error) {
      console.error(`  ${name}: FAILED — ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});
