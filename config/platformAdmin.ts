/**
 * Business OS Phase 8, Module 8.3 — a real, minimal gate for "who may
 * edit the GLOBAL SaaS Plan catalog," distinct from "who is a tenant
 * `admin`." This app has no platform-level Super Admin role tier yet
 * (explicitly out of scope until Module 8.5's Org Console) — rather
 * than inventing one speculatively, this reuses the same bearer-secret
 * pattern `config/cron.ts`/`verifyCronSecret.ts` already established
 * for "an operation no tenant session should be able to trigger on its
 * own": a real, deployment-level secret a tenant admin's own JWT simply
 * doesn't carry, so a tenant Admin — even the highest in-app RBAC tier
 * — structurally cannot modify global plan definitions without it.
 */
export const PLATFORM_ADMIN_SECRET = process.env.PLATFORM_ADMIN_SECRET || "";
export const IS_PLATFORM_ADMIN_CONFIGURED = PLATFORM_ADMIN_SECRET.length > 0;
