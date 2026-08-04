import { createLogger } from "./logger";

const logger = createLogger({ service: "startup" });

/**
 * RC-2 Enterprise Security Hardening — Secrets: startup validation.
 *
 * Six real encryption/signing secrets across this codebase each have
 * their own "dev-only-insecure-*" fallback constant (see
 * config/auth.ts's getMfaEncryptionSecret, config/identityOAuth.ts's
 * getIdentityOAuthStateSecret, config/tenantCredentials.ts,
 * config/webhooks.ts, config/calendar.ts, and
 * lib/services/storage/signedUrl.ts) — a deliberate, disclosed
 * "fail loud in production, not at boot" posture (the same one
 * JWT_ACCESS_TOKEN_SECRET's own doc comment establishes: this app
 * must still start with zero configuration for local dev). The gap
 * this closes: every one of those six fallbacks is silent — nothing
 * warns an operator their production deployment is actually running
 * on a secret value checked into this very source file, UNLESS/UNTIL
 * the specific feature it backs is first used (MFA setup, an OAuth
 * login, a tenant credential save, a webhook secret rotation, a
 * calendar connection, a local-storage signed download) — often long
 * after a real deploy, and easy to miss in a log stream even then.
 *
 * This module is the one, up-front, centralized check — run once at
 * process start via instrumentation.ts (Next.js's own supported
 * startup hook), not per-request and not per-feature-use. It only
 * WARNS (loudly, at "error" level so it isn't lost among routine
 * "info" logs) — it deliberately does not throw/exit, matching every
 * one of these config files' own existing "still starts, but insecure
 * until configured" posture rather than introducing a new fail-closed
 * behavior for six pre-existing settings this pass didn't invent.
 * Checks the RAW env var directly (never imports the six config
 * getters themselves, which would require duplicating each one's own
 * fallback string here and re-breaking silently if a fallback string
 * ever changes) — "is this specific env var set at all" is the real
 * question, independent of what any fallback happens to be.
 */
const REQUIRED_IN_PRODUCTION = [
  { envVar: "JWT_ACCESS_TOKEN_SECRET", purpose: "signs every access token — see config/auth.ts's own resolveAccessTokenSecret" },
  { envVar: "MFA_ENCRYPTION_SECRET", purpose: "encrypts every user's TOTP secret at rest" },
  { envVar: "AUTH_OAUTH_STATE_SECRET", purpose: "signs the OAuth login CSRF state param and the OAuth-MFA pending token" },
  { envVar: "TENANT_CREDENTIAL_ENCRYPTION_SECRET", purpose: "encrypts every organization's own integration credentials at rest" },
  { envVar: "WEBHOOK_SECRET_ENCRYPTION_SECRET", purpose: "encrypts outbound webhook endpoint secrets at rest" },
  { envVar: "CALENDAR_TOKEN_ENCRYPTION_SECRET", purpose: "encrypts Calendar/Meeting OAuth tokens at rest, and signs that flow's own OAuth state" },
] as const;

/** Also flagged, but at "warn" (not "error") — these fail CLOSED
 *  already (the route/job stays fully inert without them, never an
 *  insecure default), so an unset one is an availability gap, not a
 *  silent security downgrade — worth surfacing at startup anyway
 *  since "cron jobs never run" / "the platform-admin API 401s
 *  everything" are easy to misdiagnose as a bug days later. */
const RECOMMENDED_IN_PRODUCTION = [
  { envVar: "CRON_SECRET", purpose: "authenticates scheduled-job triggers — without it, app/api/cron/* stays fully inert" },
  { envVar: "PLATFORM_ADMIN_SECRET", purpose: "gates the global Plan catalog + platform-only routes — without it, every one of those 401s" },
  { envVar: "MONGODB_URI", purpose: "without it, every repository falls back to in-memory storage — data does not persist across restarts and is not shared across instances" },
  { envVar: "ERROR_TRACKING_PROVIDER", purpose: "without it, unhandled API errors and terminal background-job failures are only visible in stdout/stderr logs, never forwarded to an external tracker — see config/errorTracking.ts" },
] as const;

export function runStartupValidation(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missingSecrets = REQUIRED_IN_PRODUCTION.filter((item) => !process.env[item.envVar]);
  const missingRecommended = RECOMMENDED_IN_PRODUCTION.filter((item) => !process.env[item.envVar]);

  if (missingSecrets.length > 0) {
    for (const item of missingSecrets) {
      logger.error("startup.insecure_secret_fallback", {
        envVar: item.envVar,
        purpose: item.purpose,
        message: `${item.envVar} is not set in a production environment — this secret is running on its dev-only fallback value, which is checked into this app's own source and is NOT safe for production. Set a real ${item.envVar} before this deployment handles real traffic.`,
      });
    }
  }

  for (const item of missingRecommended) {
    logger.warn("startup.recommended_env_var_missing", { envVar: item.envVar, purpose: item.purpose });
  }

  if (missingSecrets.length === 0 && missingRecommended.length === 0) {
    logger.info("startup.validation_passed", { message: "All production-required and recommended environment variables are configured." });
  }
}
