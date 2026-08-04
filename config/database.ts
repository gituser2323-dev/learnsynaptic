/**
 * Single source of truth for database configuration. Server-only — never
 * NEXT_PUBLIC_* — a connection string must never reach the client bundle.
 *
 * IS_MONGODB_CONFIGURED gates which repository each entity's registry
 * getter selects (see lib/db/registry.ts): unset means the app runs
 * against in-memory dev repositories instead of failing to build or start.
 */

export const MONGODB_URI = process.env.MONGODB_URI || "";
export const IS_MONGODB_CONFIGURED = MONGODB_URI.length > 0;
