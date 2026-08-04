import mongoose, { type ClientSession } from "mongoose";
import { IS_MONGODB_CONFIGURED } from "@/config/database";
import { getConnection } from "./connection";

/**
 * Runs `fn` inside a real MongoDB transaction (requires a replica set —
 * Atlas clusters support this by default; a bare standalone `mongod`
 * does not). Use this for operations that span more than one collection
 * and must succeed or fail together — e.g. creating a Registration while
 * incrementing a Campaign's registration count (see
 * lib/services/registrations/registrationService.ts, the first real
 * caller of this function).
 *
 * Most single-document repository writes do NOT need this. Each mongo
 * repository method optionally accepts a `session` parameter (see
 * repositories/*.mongodb.repository.ts) so it can be composed into a
 * transaction here when a caller needs that, or run standalone
 * otherwise — the structure supports transactions without forcing every
 * write through one.
 *
 * Degrades gracefully when MongoDB isn't configured: `fn` still runs,
 * with `session` as `undefined` (every repository write method treats a
 * missing session as "no session", so this is a no-op for them, not an
 * error). The atomicity guarantee only exists — and only matters — once
 * a real MongoDB deployment is configured; in-memory repositories have
 * no transaction concept to begin with. This gap only surfaced once this
 * function got its first real caller — it was never exercised before.
 */
export async function runInTransaction<T>(
  fn: (session: ClientSession | undefined) => Promise<T>,
): Promise<T> {
  if (!IS_MONGODB_CONFIGURED) {
    return fn(undefined);
  }

  await getConnection();
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
