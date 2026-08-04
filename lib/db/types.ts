/**
 * Shared database-layer types — used across every model/repository in
 * lib/db/, not specific to any one entity.
 */

export interface AuditFields {
  createdAt: string;
  updatedAt: string;
}

/** Bumped whenever a schema change needs a corresponding entry in
 *  lib/db/migrations/. Not read anywhere yet — this is the marker future
 *  migrations key off of once there's a first schema change to migrate. */
export const SCHEMA_VERSION = 1;

/**
 * Thrown by a mongo repository's create() when MongoDB rejects an insert
 * because of a unique index violation (error code 11000) — Campaign.code
 * and the Registration (leadId, programSlug) compound index both use
 * this. Callers catch this specific type instead of a generic
 * Mongoose/MongoServerError, and decide what "duplicate" means for that
 * entity (reject vs. return the existing record) — that policy belongs
 * in a service layer, not in the repository.
 */
export class DuplicateKeyError extends Error {
  constructor(
    public readonly entity: string,
    public readonly key: Record<string, unknown>,
  ) {
    super(`Duplicate ${entity}: ${JSON.stringify(key)}`);
    this.name = "DuplicateKeyError";
  }
}

/** True when `error` is a MongoDB duplicate-key error (E11000). */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}
