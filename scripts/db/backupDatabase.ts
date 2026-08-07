import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { MONGODB_URI, IS_MONGODB_CONFIGURED } from "@/config/database";
import { backupMonitoringService } from "@/lib/services/backupMonitoring";

/**
 * RC-5 — Backup, Restore & Disaster Recovery.
 *
 * Thin wrapper around the official `mongodump` tool (MongoDB Database
 * Tools) rather than a hand-rolled per-collection export — mongodump
 * already handles BSON type fidelity, indexes-aware dumps, and is the
 * same tool that works identically against a local mongod, a
 * self-hosted replica set, or MongoDB Atlas (`--uri` accepts an
 * `mongodb+srv://` connection string unchanged). See DR_RUNBOOK.md §3
 * for the production (Atlas Cloud Backup) strategy this supplements —
 * this script is the fallback/operator-triggered path, not a
 * replacement for provider-native continuous backup.
 *
 * Output is a single gzip'd archive (`--archive --gzip`), timestamped,
 * written to backups/ (gitignored — a backup archive must never be
 * committed to source control).
 *
 * Usage:
 *   npm run db:backup
 *   npm run db:backup -- --out ./backups/custom-name.archive.gz
 */

function findMongodump(): string {
  const check = spawnSync("mongodump", ["--version"], { stdio: "ignore" });
  if (check.error || check.status !== 0) {
    console.error(
      "mongodump not found on PATH. Install the MongoDB Database Tools " +
        "(brew install mongodb-database-tools, or see " +
        "https://www.mongodb.com/docs/database-tools/installation/) before running a backup.",
    );
    process.exit(1);
  }
  return "mongodump";
}

function defaultOutputPath(): string {
  const dir = path.join(process.cwd(), "backups");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(dir, `learnsynaptic-${stamp}.archive.gz`);
}

async function main(): Promise<void> {
  if (!IS_MONGODB_CONFIGURED) {
    console.error("MONGODB_URI is not set — nothing to back up (this environment runs on in-memory repositories).");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const outFlagIndex = args.indexOf("--out");
  const outputPath = outFlagIndex >= 0 && args[outFlagIndex + 1] ? args[outFlagIndex + 1] : defaultOutputPath();

  const mongodump = findMongodump();

  console.log(`Backing up database to ${outputPath} ...`);
  const startedAt = Date.now();
  const result = spawnSync(
    mongodump,
    ["--uri", MONGODB_URI, "--archive=" + outputPath, "--gzip"],
    { stdio: "inherit" },
  );
  const durationMs = Date.now() - startedAt;

  if (result.status !== 0) {
    console.error("mongodump exited with a non-zero status — backup did NOT complete successfully.");
    // RC-5 — recorded (and alerted through the existing error-tracking
    // pipeline, see backupMonitoringService's own doc comment) even on
    // failure — an operator watching backup health needs to know a run
    // was attempted and failed, not just see silence.
    await backupMonitoringService.recordBackupResult({
      status: "failure",
      completedAt: new Date().toISOString(),
      durationMs,
      error: `mongodump exited with status ${result.status}`,
    });
    process.exit(result.status ?? 1);
  }

  const sizeBytes = existsSync(outputPath) ? statSync(outputPath).size : undefined;
  await backupMonitoringService.recordBackupResult({
    status: "success",
    completedAt: new Date().toISOString(),
    durationMs,
    sizeBytes,
  });

  console.log(`Backup complete: ${outputPath}`);
  console.log(
    "Reminder: this archive contains full production data (including encrypted tenant " +
      "credentials and PII). Store it only in an access-controlled, encrypted-at-rest location " +
      "(see DR_RUNBOOK.md §12) — never commit it, never attach it to a chat/ticket/email.",
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Backup script crashed:", error);
  process.exit(1);
});
