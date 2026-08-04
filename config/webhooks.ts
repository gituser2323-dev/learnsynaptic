/**
 * Single source of truth for Generic Webhooks & Team Notifications
 * (Phase 6, Module 6.5) secret encryption — server-only, never
 * NEXT_PUBLIC_*, the same shape config/calendar.ts's own encryption
 * secret already established.
 */

/** AES-256-GCM key for encrypting webhook endpoint secrets and
 *  Slack/Teams/Discord webhook URLs at rest (secretCrypto.ts) — a real
 *  server secret, deliberately distinct from
 *  CALENDAR_TOKEN_ENCRYPTION_SECRET (a different module's secret,
 *  same "don't reuse one secret across unrelated cryptographic
 *  purposes" key hygiene Module 6.3 already established relative to
 *  JWT_ACCESS_TOKEN_SECRET). Falls back to a clearly-labeled dev-only
 *  value rather than throwing at import time. */
export function getWebhookSecretEncryptionSecret(): string {
  return process.env.WEBHOOK_SECRET_ENCRYPTION_SECRET || "dev-only-insecure-webhook-secret-32b";
}
