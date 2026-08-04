import { createLogger } from "./logger";
import { STORAGE_ACTIVE_PROVIDER } from "@/config/storage";
import { WHATSAPP_ACTIVE_PROVIDER } from "@/config/whatsapp";
import { EMAIL_ACTIVE_PROVIDER } from "@/config/emailChannel";

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
 *
 * RC-4 — Deployment & Production Infrastructure adds one entry to this
 * list: MONGODB_URI, promoted from RECOMMENDED_IN_PRODUCTION to
 * REQUIRED. The mission's own explicit CRITICAL-configuration example
 * list names "DATABASE" first — running production traffic against the
 * in-memory repository fallback isn't an insecure-but-functional
 * default the way the six secrets above are, it's silent, total data
 * loss (nothing persists past a restart, nothing is shared across
 * serverless instances). Still only WARNS (loudly), same posture as
 * everything else here — GET /api/health/ready's own real MongoDB
 * round-trip is the actual "fail safely" signal a load balancer/uptime
 * monitor acts on.
 *
 * QUEUE CONFIGURATION (also named in the mission's own CRITICAL list)
 * has no separate env var to check: this app's real, deployed queue IS
 * the MongoDB-backed scheduler (see lib/services/scheduler/
 * schedulerService.ts's own doc comment on the RC-3 architecture
 * decision — no Redis/BullMQ exists), drained by Vercel Cron calling
 * CRON_SECRET-authenticated app/api/cron/run-due-jobs. MONGODB_URI
 * (below) + CRON_SECRET (RECOMMENDED_IN_PRODUCTION below) together ARE
 * this app's complete queue-configuration check.
 */
const REQUIRED_IN_PRODUCTION = [
  { envVar: "JWT_ACCESS_TOKEN_SECRET", purpose: "signs every access token — see config/auth.ts's own resolveAccessTokenSecret" },
  { envVar: "MFA_ENCRYPTION_SECRET", purpose: "encrypts every user's TOTP secret at rest" },
  { envVar: "AUTH_OAUTH_STATE_SECRET", purpose: "signs the OAuth login CSRF state param and the OAuth-MFA pending token" },
  { envVar: "TENANT_CREDENTIAL_ENCRYPTION_SECRET", purpose: "encrypts every organization's own integration credentials at rest" },
  { envVar: "WEBHOOK_SECRET_ENCRYPTION_SECRET", purpose: "encrypts outbound webhook endpoint secrets at rest" },
  { envVar: "CALENDAR_TOKEN_ENCRYPTION_SECRET", purpose: "encrypts Calendar/Meeting OAuth tokens at rest, and signs that flow's own OAuth state" },
  { envVar: "MONGODB_URI", purpose: "the database — without it, every repository silently falls back to in-memory storage: no persistence across restarts, no sharing across serverless instances" },
] as const;

/** Also flagged, but at "warn" (not "error") — these fail CLOSED
 *  already (the route/job stays fully inert without them, never an
 *  insecure default), so an unset one is an availability gap, not a
 *  silent security downgrade — worth surfacing at startup anyway
 *  since "cron jobs never run" / "the platform-admin API 401s
 *  everything" are easy to misdiagnose as a bug days later. */
const RECOMMENDED_IN_PRODUCTION = [
  { envVar: "CRON_SECRET", purpose: "authenticates scheduled-job triggers, and is this app's own queue-worker authentication — without it, app/api/cron/* (the ONLY thing that drains the scheduler in production) stays fully inert" },
  { envVar: "PLATFORM_ADMIN_SECRET", purpose: "gates the global Plan catalog + platform-only routes — without it, every one of those 401s" },
  { envVar: "ERROR_TRACKING_PROVIDER", purpose: "without it, unhandled API errors and terminal background-job failures are only visible in stdout/stderr logs, never forwarded to an external tracker — see config/errorTracking.ts" },
] as const;

/**
 * RC-4 — File Storage (Module 6.2): the "local" provider writes to
 * `process.cwd()` on the running process's own filesystem (see
 * lib/services/storage/providers/local.provider.ts's own doc comment).
 * That's real, working storage for local dev — and a guaranteed
 * failure on a real serverless deployment like Vercel, where the
 * filesystem is read-only outside `/tmp`, and `/tmp` itself is neither
 * shared across concurrent instances nor durable across invocations.
 * An upload would either throw outright or appear to succeed and then
 * be unreadable moments later from a different invocation. Unlike the
 * six encryption secrets above (insecure-but-functional fallbacks),
 * this fallback is not functional at all in production — worth its own
 * check rather than folding into the generic env-var-presence lists,
 * since this isn't "is a var set," it's "is this var set to a value
 * that's actively unsafe here."
 */
function checkStorageProvider(): boolean {
  if (STORAGE_ACTIVE_PROVIDER !== "local") return true;
  logger.error("startup.ephemeral_storage_in_production", {
    envVar: "STORAGE_PROVIDER",
    message:
      "STORAGE_PROVIDER is unset (or explicitly \"local\") in a production environment — the local filesystem provider is not durable or shared on a real serverless deployment (Vercel's filesystem is read-only outside /tmp, and /tmp itself doesn't persist across invocations or instances). File uploads will fail or silently vanish. Set STORAGE_PROVIDER=aws_s3 or STORAGE_PROVIDER=cloudinary, connected via the Integrations Registry, before accepting real file uploads in production.",
  });
  return false;
}

/**
 * RC-4 — Production Safety Switches. Vercel automatically sets
 * VERCEL_ENV to "production" | "preview" | "development" for every
 * deployment (no configuration needed to get this signal on Vercel) —
 * NODE_ENV alone can't distinguish a real production deploy from a
 * preview/staging one, since Next.js sets NODE_ENV=production for
 * BOTH (`next build`+`next start` always does, regardless of Vercel's
 * own environment tier). The real, common mistake this guards against:
 * an operator copies production's env wholesale into a staging/preview
 * deployment to "get it working fast," and a staging bug now messages
 * or emails a REAL customer. This only WARNS — a preview deployment
 * deliberately testing against a real vendor SANDBOX account is a
 * legitimate, real use case this function can't distinguish from a
 * genuine misconfiguration, so it surfaces the risk loudly rather than
 * blocking a scenario it can't safely assume is wrong. Silently does
 * nothing on non-Vercel deployments (VERCEL_ENV unset) — there's no
 * reliable staging/production signal to check there at all.
 */
function checkPreviewEnvironmentSafety(): void {
  if (process.env.VERCEL_ENV !== "preview") return;

  if (WHATSAPP_ACTIVE_PROVIDER !== "console") {
    logger.warn("startup.real_provider_in_preview_environment", {
      envVar: "WHATSAPP_PROVIDER",
      provider: WHATSAPP_ACTIVE_PROVIDER,
      message: `This is a Vercel preview/staging deployment (VERCEL_ENV=preview) with WHATSAPP_PROVIDER=${WHATSAPP_ACTIVE_PROVIDER} — a real WhatsApp send provider, not the safe no-op "console" default. If this preview environment's credentials point at a real, customer-facing number (rather than a vendor sandbox/test number), any bulk send or campaign test here will message real customers. Verify this is intentional.`,
    });
  }

  if (EMAIL_ACTIVE_PROVIDER !== "console") {
    logger.warn("startup.real_provider_in_preview_environment", {
      envVar: "EMAIL_PROVIDER",
      provider: EMAIL_ACTIVE_PROVIDER,
      message: `This is a Vercel preview/staging deployment (VERCEL_ENV=preview) with EMAIL_PROVIDER=${EMAIL_ACTIVE_PROVIDER} — a real email send provider, not the safe no-op "console" default. If this preview environment's credentials are shared with production, any campaign/transactional email test here will reach real customers. Verify this is intentional.`,
    });
  }
}

export function runStartupValidation(): void {
  // RC-4 — checkPreviewEnvironmentSafety() deliberately runs
  // regardless of NODE_ENV: a Vercel preview deployment already has
  // NODE_ENV=production (see this function's own doc comment), so
  // gating on NODE_ENV here would make this check indistinguishable
  // from the real-production-only checks below and never actually
  // fire for its own intended target.
  checkPreviewEnvironmentSafety();

  if (process.env.NODE_ENV !== "production") return;

  const missingSecrets = REQUIRED_IN_PRODUCTION.filter((item) => !process.env[item.envVar]);
  const missingRecommended = RECOMMENDED_IN_PRODUCTION.filter((item) => !process.env[item.envVar]);
  const storageOk = checkStorageProvider();

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

  if (missingSecrets.length === 0 && missingRecommended.length === 0 && storageOk) {
    logger.info("startup.validation_passed", { message: "All production-required and recommended environment variables are configured." });
  }
}
