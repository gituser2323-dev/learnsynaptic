import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MONGODB_URI, IS_MONGODB_CONFIGURED } from "@/config/database";
import { errorTrackingService } from "@/lib/services/errorTracking";

/**
 * RC-5 — Backup, Restore & Disaster Recovery.
 *
 * Automated backup verification: restores the most recent (or a named)
 * backup archive into an ISOLATED scratch database — never the app's
 * own MONGODB_URI — then proves the archive actually contains usable
 * data by comparing collection counts against the live source database,
 * and finally drops the scratch database so this leaves no residue.
 *
 * This is the "prove the backup is actually restorable" half of the
 * mission's mandatory restore testing (DR_RUNBOOK.md §5) — designed to
 * run unattended (this exact script is what backup-monitoring, task
 * RC-5 #112, schedules), not just as a one-off manual drill. It never
 * touches the application's real database as a restore TARGET; it only
 * reads counts from it for comparison.
 *
 * Usage:
 *   npm run db:verify-backup                              # verifies the newest backups/*.archive.gz
 *   npm run db:verify-backup -- --archive ./backups/x.gz   # verifies a specific archive
 */

const CRITICAL_COLLECTIONS = ["organizations", "users"];

function findMostRecentArchive(): string | undefined {
  const dir = path.join(process.cwd(), "backups");
  if (!existsSync(dir)) return undefined;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".archive.gz"))
    .map((f) => path.join(dir, f));
  if (files.length === 0) return undefined;
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function sourceDbName(sourceUri: string): string {
  const url = new URL(sourceUri.replace("mongodb+srv://", "https://").replace("mongodb://", "http://"));
  return url.pathname.replace(/^\//, "") || "learnsynaptic";
}

function deriveScratchUri(sourceUri: string): string {
  const url = new URL(sourceUri.replace("mongodb+srv://", "https://").replace("mongodb://", "http://"));
  const dbName = sourceDbName(sourceUri);
  const scratchName = `${dbName}_verify_scratch`;
  const isSrv = sourceUri.startsWith("mongodb+srv://");
  const scheme = isSrv ? "mongodb+srv://" : "mongodb://";
  return sourceUri.replace(`${scheme}${url.host}/${dbName}`, `${scheme}${url.host}/${scratchName}`);
}

async function countCollections(uri: string): Promise<Record<string, number>> {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10_000 }).asPromise();
  try {
    const db = conn.db;
    if (!db) throw new Error("no database handle on connection");
    const collections = await db.listCollections().toArray();
    const counts: Record<string, number> = {};
    for (const { name } of collections) {
      counts[name] = await db.collection(name).countDocuments();
    }
    return counts;
  } finally {
    await conn.close();
  }
}

async function dropDatabase(uri: string): Promise<void> {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10_000 }).asPromise();
  try {
    await conn.dropDatabase();
  } finally {
    await conn.close();
  }
}

async function main(): Promise<void> {
  if (!IS_MONGODB_CONFIGURED) {
    console.error("MONGODB_URI is not set — nothing to verify against.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const archiveFlagIndex = args.indexOf("--archive");
  const archivePath = archiveFlagIndex >= 0 ? args[archiveFlagIndex + 1] : findMostRecentArchive();

  if (!archivePath || !existsSync(archivePath)) {
    console.error("No backup archive found to verify (looked in ./backups). Run `npm run db:backup` first, or pass --archive <path>.");
    process.exit(1);
  }

  const scratchUri = deriveScratchUri(MONGODB_URI);
  console.log(`Verifying ${archivePath}`);
  console.log(`  source database counts from: ${MONGODB_URI.replace(/\/\/[^@]*@/, "//<redacted>@")}`);
  console.log(`  restore target (scratch, isolated): ${scratchUri.replace(/\/\/[^@]*@/, "//<redacted>@")}`);

  const sourceCounts = await countCollections(MONGODB_URI);

  const dbName = sourceDbName(MONGODB_URI);
  const scratchDbName = `${dbName}_verify_scratch`;
  const restoreResult = spawnSync(
    "mongorestore",
    [
      "--uri", scratchUri,
      "--archive=" + archivePath,
      "--gzip",
      "--drop",
      // The archive's own namespaces are recorded as `<originalDb>.<collection>`
      // regardless of the target URI's db name — without an explicit
      // nsInclude that matches the ORIGINAL namespace plus an nsFrom/nsTo
      // remap, mongorestore silently restores 0 documents (every
      // namespace gets filtered out as "not included" — verified
      // directly against this archive during RC-5).
      "--nsInclude", `${dbName}.*`,
      "--nsFrom", `${dbName}.*`,
      "--nsTo", `${scratchDbName}.*`,
    ],
    { stdio: "inherit" },
  );
  if (restoreResult.status !== 0) {
    console.error("mongorestore into the scratch database failed — backup verification: FAIL.");
    // RC-5 — reported through the existing error-tracking pipeline
    // (RC-3), never a second alerting mechanism — a failed restore-
    // verification is exactly the class of incident the mission asks
    // to be wired into the same observability/notification path as
    // everything else.
    await errorTrackingService.captureException(new Error("Backup restore verification failed: mongorestore exited non-zero"), {
      operation: "backup.restore_verification_failed",
      severity: "error",
    });
    process.exit(1);
  }

  const restoredCounts = await countCollections(scratchUri);

  let ok = true;
  console.log("\nCollection count comparison (source live DB vs. restored archive):");
  for (const name of CRITICAL_COLLECTIONS) {
    const source = sourceCounts[name] ?? 0;
    const restored = restoredCounts[name] ?? 0;
    const pass = restored > 0 || source === 0;
    ok = ok && pass;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}: source=${source} restored=${restored}`);
  }

  const totalRestored = Object.values(restoredCounts).reduce((a, b) => a + b, 0);
  console.log(`\nTotal documents restored across ${Object.keys(restoredCounts).length} collections: ${totalRestored}`);

  console.log("\nCleaning up scratch database...");
  await dropDatabase(scratchUri);

  if (!ok) {
    console.error("\nBackup verification: FAIL — a critical collection restored empty while the source has data.");
    await errorTrackingService.captureException(
      new Error("Backup restore verification failed: a critical collection restored empty"),
      { operation: "backup.restore_verification_failed", severity: "error" },
    );
    process.exit(1);
  }
  console.log("\nBackup verification: PASS — archive is restorable and contains the expected critical data.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backup verification script crashed:", error);
    process.exit(1);
  });
