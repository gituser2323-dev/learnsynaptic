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
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
