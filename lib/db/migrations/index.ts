import type { ClientSession } from "mongoose";
import { getConnection } from "../connection";
import { runInTransaction } from "../transaction";

/**
 * Migration-ready scaffold. No migrations exist yet — this is the
 * initial schema, so there's nothing to migrate from. When a future
 * schema change needs to run against existing data (renaming a field,
 * backfilling a new required field, reshaping a nested object), add a
 * Migration entry below rather than mutating documents ad hoc.
 *
 * Each migration runs at most once: runPendingMigrations() records
 * applied ids in a `_migrations` collection and skips anything already
 * there. Each migration's `up` runs inside a transaction (see
 * ../transaction.ts), so a failure partway through doesn't leave data
 * half-migrated.
 */
export interface Migration {
  /** Sortable, unique id — convention: "YYYY-MM-DD-short-description". */
  id: string;
  description: string;
  /** ClientSession | undefined to match runInTransaction()'s signature —
   *  in practice always a real session here, since runPendingMigrations()
   *  already requires a working MongoDB connection (via getConnection())
   *  before it ever calls runInTransaction(). */
  up: (session: ClientSession | undefined) => Promise<void>;
}

export const migrations: Migration[] = [
  // Example shape for the first real migration:
  // {
  //   id: "2026-08-01-backfill-lead-status",
  //   description: "Set status='new' on any Lead created before the status field existed",
  //   up: async (session) => {
  //     const { LeadModel } = await import("../models/lead.model");
  //     await LeadModel.updateMany(
  //       { status: { $exists: false } },
  //       { $set: { status: "new" } },
  //       { session },
  //     );
  //   },
  // },
];

export async function runPendingMigrations(): Promise<void> {
  if (migrations.length === 0) return;

  const conn = await getConnection();
  const migrationsCollection = conn.connection.collection("_migrations");

  for (const migration of migrations) {
    const alreadyApplied = await migrationsCollection.findOne({ id: migration.id });
    if (alreadyApplied) continue;

    await runInTransaction(async (session) => {
      await migration.up(session);
      await migrationsCollection.insertOne({ id: migration.id, appliedAt: new Date() }, { session });
    });
  }
}
