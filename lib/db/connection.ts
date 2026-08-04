import mongoose from "mongoose";
import { MONGODB_URI } from "@/config/database";

/**
 * Shared, cached Mongoose connection used by every repository under
 * lib/db/repositories/. One connection (with its own internal pool) per
 * running Node process / serverless instance, reused across calls
 * instead of opening a new one per request — the standard pattern for
 * Mongoose in a Next.js deployment.
 *
 * maxPoolSize is deliberately modest (10, not Mongoose's default 100):
 * in a serverless deployment many function instances each hold their own
 * pool, and a large per-instance pool multiplies fast against MongoDB
 * Atlas's cluster-wide connection ceiling. minPoolSize: 0 means an idle
 * instance holds no connections open, which matters for the same reason.
 */

declare global {
  var __dbConnection:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

if (!global.__dbConnection) {
  global.__dbConnection = { conn: null, promise: null };
}
const cached = global.__dbConnection;

export async function getConnection(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
      // RC-4 — Mongoose's own default (autoIndex: true) runs
      // createIndex() for every model on EVERY connection, meaning
      // every cold start in production: real, avoidable latency on the
      // hot path, and lock contention against a large collection this
      // mission's own explicit "do NOT automatically create destructive
      // indexes/migrations during every production boot" instruction
      // rules out. Index creation/sync is instead a deliberate,
      // operator-triggered step — see scripts/syncIndexes.ts. Local dev
      // and CI (in-memory repositories, no MONGODB_URI, so this file
      // isn't even reached) are unaffected; a real MongoDB pointed at
      // from a non-production NODE_ENV still gets the convenient
      // auto-created indexes developers expect.
      autoIndex: process.env.NODE_ENV !== "production",
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // RC-4 — found live during this pass's own infrastructure audit: a
    // rejected connect() promise was being cached forever. Without this
    // reset, one transient MongoDB outage (a brief network blip, Atlas
    // failover, cold-start racing DNS) would permanently poison this
    // module-level cache for the rest of the process/serverless
    // instance's lifetime — every subsequent call would immediately
    // re-await the SAME already-rejected promise instead of ever
    // attempting a new connection, even after MongoDB recovered.
    // Clearing it here is what makes the NEXT call actually retry.
    cached.promise = null;
    throw error;
  }
  return cached.conn;
}
