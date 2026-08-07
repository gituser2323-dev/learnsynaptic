import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { MONGODB_URI } from "@/config/database";

/**
 * RC-5 — Backup, Restore & Disaster Recovery.
 *
 * Thin wrapper around `mongorestore`. Deliberately harder to point at
 * the wrong database than a bare `mongorestore` invocation would be —
 * the mission's own explicit requirement is "never restore production
 * backups over the active production database"; this script makes that
 * the SAFE default rather than something an operator has to remember.
 *
 * Safety rules (all enforced, not just documented):
 *   1. --target is REQUIRED — there is no default target. An operator
 *      must name the database they intend to overwrite.
 *   2. If --target resolves to the SAME connection string as this
 *      process's own MONGODB_URI (the "active" database as far as this
 *      app is concerned), the restore is refused unless
 *      --i-understand-this-overwrites-the-active-database is also
 *      passed — deliberately long and explicit, not a short flag that
 *      could be typed by muscle memory.
 *   3. Every restore runs with --drop, so the target ends up exactly
 *      matching the archive's contents (no stale leftover documents
 *      from whatever was in the target before) — this is why rule 1/2
 *      matter: --drop against the wrong database is destructive.
 *
 * Usage (restore drill / isolated environment — the normal case):
 *   npm run db:restore -- --archive ./backups/learnsynaptic-...archive.gz \
 *     --target "mongodb://127.0.0.1:27117/learnsynaptic_restore_drill?replicaSet=rs-learnsynaptic"
 */

function findMongorestore(): string {
  const check = spawnSync("mongorestore", ["--version"], { stdio: "ignore" });
  if (check.error || check.status !== 0) {
    console.error(
      "mongorestore not found on PATH. Install the MongoDB Database Tools " +
        "(brew install mongodb-database-tools) before running a restore.",
    );
    process.exit(1);
  }
  return "mongorestore";
}

function readFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function dbNameFromUri(uri: string): string {
  const url = new URL(uri.replace("mongodb+srv://", "https://").replace("mongodb://", "http://"));
  return url.pathname.replace(/^\//, "") || "learnsynaptic";
}

function main(): void {
  const args = process.argv.slice(2);
  const archivePath = readFlag(args, "--archive");
  const target = readFlag(args, "--target");
  const acknowledgedOverwrite = args.includes("--i-understand-this-overwrites-the-active-database");

  if (!archivePath || !existsSync(archivePath)) {
    console.error("--archive <path> is required and must point at an existing backup archive.");
    process.exit(1);
  }
  if (!target) {
    console.error(
      "--target <mongodb-uri> is required. There is no default — you must name the exact " +
        "database you intend to overwrite. For a restore drill, use an isolated database name " +
        "(e.g. a *_restore_drill suffix), never the app's own MONGODB_URI.",
    );
    process.exit(1);
  }
  if (target === MONGODB_URI && !acknowledgedOverwrite) {
    console.error(
      "Refusing: --target is identical to this process's own MONGODB_URI — that is the active " +
        "application database. Restoring here with --drop would destroy current production/dev " +
        "data. If this is genuinely intended (e.g. a documented disaster-recovery event, not a " +
        "routine drill), re-run with --i-understand-this-overwrites-the-active-database.",
    );
    process.exit(1);
  }

  const mongorestore = findMongorestore();

  // The archive stores namespaces as `<originalDb>.<collection>` regardless
  // of --target's own db name. Default the assumed original db name to this
  // process's own MONGODB_URI's db name (true for any archive produced by
  // `npm run db:backup` against this app); override with --source-db for an
  // archive produced elsewhere. Without an explicit nsInclude that matches
  // the ORIGINAL namespace plus an nsFrom/nsTo remap, mongorestore silently
  // restores 0 documents — verified directly during RC-5.
  const sourceDb = readFlag(args, "--source-db") ?? dbNameFromUri(MONGODB_URI || target);
  const targetDb = dbNameFromUri(target);

  console.log(`Restoring ${archivePath} (db "${sourceDb}") into ${target.replace(/\/\/[^@]*@/, "//<redacted>@")} (db "${targetDb}", --drop) ...`);
  const result = spawnSync(
    mongorestore,
    [
      "--uri", target,
      "--archive=" + archivePath,
      "--gzip",
      "--drop",
      "--nsInclude", `${sourceDb}.*`,
      "--nsFrom", `${sourceDb}.*`,
      "--nsTo", `${targetDb}.*`,
    ],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    console.error("mongorestore exited with a non-zero status — restore did NOT complete successfully.");
    process.exit(result.status ?? 1);
  }

  console.log("Restore complete. Next: run verification (npm run db:verify-backup or the app's own integrity checks) before treating this environment as trustworthy — see DR_RUNBOOK.md §5.");
}

main();
