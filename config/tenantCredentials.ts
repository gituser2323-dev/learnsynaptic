/**
 * Business OS Phase 8, Module 8.2 — Tenant Context & Credentials.
 * Single source of truth for tenant-owned provider credential
 * encryption — server-only, never NEXT_PUBLIC_*, the same shape
 * config/calendar.ts's and config/webhooks.ts's own encryption
 * secrets already established.
 */

/** AES-256-GCM key for encrypting per-organization provider
 *  credentials at rest (credentialCrypto.ts) — a real server secret,
 *  deliberately distinct from CALENDAR_TOKEN_ENCRYPTION_SECRET and
 *  WEBHOOK_SECRET_ENCRYPTION_SECRET (different modules' secrets, same
 *  "don't reuse one secret across unrelated cryptographic purposes"
 *  key hygiene this codebase has held since Module 6.3). Falls back to
 *  a clearly-labeled dev-only value rather than throwing at import
 *  time. */
export function getTenantCredentialEncryptionSecret(): string {
  return process.env.TENANT_CREDENTIAL_ENCRYPTION_SECRET || "dev-only-insecure-tenant-cred-secret-32b";
}
