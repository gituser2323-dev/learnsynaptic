import { IS_MONGODB_CONFIGURED } from "@/config/database";
import { IS_CRON_CONFIGURED } from "@/config/cron";
import { STORAGE_ACTIVE_PROVIDER } from "@/config/storage";
import { ERROR_TRACKING_ACTIVE_PROVIDER } from "@/config/errorTracking";
import { WHATSAPP_ACTIVE_PROVIDER, META_CLOUD_API_CONFIG } from "@/config/whatsapp";
import { EMAIL_ACTIVE_PROVIDER, POSTMARK_CONFIG } from "@/config/emailChannel";
import { AI_ACTIVE_PROVIDER } from "@/config/aiInsights";
import { RAZORPAY_CONFIG, STRIPE_CONFIG, CASHFREE_CONFIG } from "@/config/payments";
import { GOOGLE_OAUTH_CONFIG, MICROSOFT_OAUTH_CONFIG, ZOOM_OAUTH_CONFIG } from "@/config/calendar";
import { getScheduledJobRepository } from "@/lib/db";

/**
 * RC-4 — Deployment & Production Infrastructure. Section 34's own
 * "safe preflight mechanism/checklist": Database configured? Auth
 * configured? Encryption configured? Queue configured? Workers
 * reachable? Cron configured? Storage configured? Observability
 * configured? — plus, separately, tenant-level optional integrations
 * reported as configuration STATE, never a platform-blocking failure
 * (the mission's own explicit distinction).
 *
 * Deliberately checks env-var PRESENCE (never live-verifies a vendor
 * credential is actually valid — that's what a real send/charge/OAuth
 * grant does, not a startup check) for every category except Database,
 * which also does one real, timeout-bounded round-trip — the same
 * "presence is a proxy, a live round-trip is the real signal" split
 * GET /api/health/ready already established. Two consumers share this
 * one assessment: scripts/preflightCheck.ts (a CLI gate, e.g. before a
 * deploy) and GET /api/admin/system/preflight (live visibility on an
 * already-running instance, since there's no shell access into a
 * Vercel deployment).
 */

export type PreflightStatus = "ok" | "warning" | "critical";

export interface PreflightCategory {
  category: string;
  status: PreflightStatus;
  detail: string;
}

export interface TenantIntegrationStatus {
  /** A human label, e.g. "WhatsApp (Meta Cloud API)" — never blocks
   *  the platform on its own; see this file's own doc comment. */
  integration: string;
  configured: boolean;
  detail: string;
}

export interface PreflightReport {
  environment: string;
  generatedAt: string;
  categories: PreflightCategory[];
  tenantIntegrations: TenantIntegrationStatus[];
  /** True only when every category is "ok" or "warning" — a "critical"
   *  category (Database unreachable, no auth secret at all — see
   *  runPreflightChecks' own per-category logic) fails the whole
   *  report. Tenant integrations never affect this. */
  overallOk: boolean;
}

const PREFLIGHT_DB_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      if (typeof timer === "object" && "unref" in timer) timer.unref();
    }),
  ]);
}

async function checkDatabase(): Promise<PreflightCategory> {
  if (!IS_MONGODB_CONFIGURED) {
    return { category: "Database", status: "critical", detail: "MONGODB_URI is not set — running on in-memory storage, no persistence." };
  }
  try {
    const repository = await getScheduledJobRepository();
    await withTimeout(repository.list({}, 1, 1), PREFLIGHT_DB_TIMEOUT_MS, "database preflight check");
    return { category: "Database", status: "ok", detail: "MONGODB_URI configured and reachable." };
  } catch (error) {
    return {
      category: "Database",
      status: "critical",
      detail: `MONGODB_URI configured but unreachable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function checkAuthentication(): PreflightCategory {
  const missing = ["JWT_ACCESS_TOKEN_SECRET", "AUTH_OAUTH_STATE_SECRET"].filter((v) => !process.env[v]);
  if (missing.length > 0) {
    return { category: "Authentication", status: "critical", detail: `Missing: ${missing.join(", ")} — running on dev-only fallback secrets.` };
  }
  return { category: "Authentication", status: "ok", detail: "JWT and OAuth-state secrets configured." };
}

function checkEncryption(): PreflightCategory {
  const missing = ["MFA_ENCRYPTION_SECRET", "TENANT_CREDENTIAL_ENCRYPTION_SECRET", "WEBHOOK_SECRET_ENCRYPTION_SECRET", "CALENDAR_TOKEN_ENCRYPTION_SECRET"].filter(
    (v) => !process.env[v],
  );
  if (missing.length > 0) {
    return { category: "Encryption", status: "critical", detail: `Missing: ${missing.join(", ")} — running on dev-only fallback keys.` };
  }
  return { category: "Encryption", status: "ok", detail: "All four encryption-at-rest keys configured." };
}

function checkQueue(): PreflightCategory {
  // This app's real queue IS the MongoDB-backed scheduler — see
  // lib/services/scheduler/schedulerService.ts's own RC-3 architecture
  // decision doc comment. "Queue configured" reduces to the same two
  // facts Cron/Database already check; reported as its own category
  // since the mission names it separately.
  if (!IS_MONGODB_CONFIGURED || !IS_CRON_CONFIGURED) {
    return { category: "Queue", status: "critical", detail: "Requires both MONGODB_URI and CRON_SECRET — see the Database/Cron categories." };
  }
  return { category: "Queue", status: "ok", detail: "MongoDB-backed scheduler configured, drained via Vercel Cron." };
}

function checkWorkers(): PreflightCategory {
  // Deliberately not "critical"/"ok" in the usual sense — there IS no
  // persistent worker process to be "reachable" in this app's actual
  // architecture (Vercel serverless + Vercel Cron, not Redis/BullMQ —
  // see CHANGELOG.md's own RC-3 entry for why that was evaluated and
  // rejected for this deployment). Reporting this as informational
  // rather than silently omitting it is the point: a future reader
  // asking "are workers reachable" gets a real answer, not silence.
  return {
    category: "Workers",
    status: "ok",
    detail: "Not applicable — no persistent worker process by design. Vercel Cron (see Cron category) directly drains the MongoDB-backed scheduler.",
  };
}

function checkCron(): PreflightCategory {
  if (!IS_CRON_CONFIGURED) {
    return { category: "Cron", status: "critical", detail: "CRON_SECRET is not set — app/api/cron/run-due-jobs stays fully inert, nothing async ever fires." };
  }
  return { category: "Cron", status: "ok", detail: "CRON_SECRET configured." };
}

function checkStorage(): PreflightCategory {
  if (STORAGE_ACTIVE_PROVIDER === "local") {
    return {
      category: "Storage",
      status: "warning",
      detail: "STORAGE_PROVIDER is unset or 'local' — not durable on a serverless deployment. Set aws_s3 or cloudinary before accepting real uploads.",
    };
  }
  return { category: "Storage", status: "ok", detail: `STORAGE_PROVIDER=${STORAGE_ACTIVE_PROVIDER}.` };
}

function checkObservability(): PreflightCategory {
  if (ERROR_TRACKING_ACTIVE_PROVIDER === "disabled") {
    return {
      category: "Observability",
      status: "warning",
      detail: "ERROR_TRACKING_PROVIDER is unset — errors are only visible in stdout/stderr logs, never forwarded to an external tracker.",
    };
  }
  return { category: "Observability", status: "ok", detail: `ERROR_TRACKING_PROVIDER=${ERROR_TRACKING_ACTIVE_PROVIDER}.` };
}

/** Tenant-level/optional integrations — reported, never blocking (the
 *  mission's own explicit "report configuration state rather than
 *  blocking the entire platform" instruction). Presence-only: whether
 *  the DEPLOYMENT-WIDE default credential is set, not whether any one
 *  organization has its own tenant-level override configured (that's a
 *  per-organization Settings concern, not a system-wide preflight
 *  one). */
function checkTenantIntegrations(): TenantIntegrationStatus[] {
  return [
    {
      integration: "WhatsApp (Meta Cloud API)",
      configured: WHATSAPP_ACTIVE_PROVIDER === "meta-cloud-api" && Boolean(META_CLOUD_API_CONFIG.accessToken),
      detail: `Active provider: ${WHATSAPP_ACTIVE_PROVIDER}. Organizations may still override via their own tenant credential regardless of this deployment-wide default.`,
    },
    {
      integration: "Email (Postmark)",
      configured: EMAIL_ACTIVE_PROVIDER === "postmark" && Boolean(POSTMARK_CONFIG.serverToken),
      detail: `Active provider: ${EMAIL_ACTIVE_PROVIDER}.`,
    },
    {
      integration: "AI (Lead Scoring / Insights / Assisted Replies)",
      configured: AI_ACTIVE_PROVIDER !== null,
      detail: AI_ACTIVE_PROVIDER ? `Active provider: ${AI_ACTIVE_PROVIDER}.` : "AI_PROVIDER unset — every AI feature degrades to 'unavailable', never fabricated.",
    },
    { integration: "Payments — Razorpay", configured: Boolean(RAZORPAY_CONFIG.keyId && RAZORPAY_CONFIG.keySecret), detail: "Platform-wide credential, gated per-organization via the Integrations Registry." },
    { integration: "Payments — Stripe", configured: Boolean(STRIPE_CONFIG.secretKey), detail: "Platform-wide credential, gated per-organization via the Integrations Registry." },
    { integration: "Payments — Cashfree", configured: Boolean(CASHFREE_CONFIG.appId && CASHFREE_CONFIG.secretKey), detail: "Platform-wide credential, gated per-organization via the Integrations Registry." },
    { integration: "Calendar — Google", configured: Boolean(GOOGLE_OAUTH_CONFIG.clientId && GOOGLE_OAUTH_CONFIG.clientSecret), detail: "Google Calendar / Google Meet OAuth app." },
    { integration: "Calendar — Microsoft", configured: Boolean(MICROSOFT_OAUTH_CONFIG.clientId && MICROSOFT_OAUTH_CONFIG.clientSecret), detail: "Outlook Calendar / Teams Meetings OAuth app." },
    { integration: "Calendar — Zoom", configured: Boolean(ZOOM_OAUTH_CONFIG.clientId && ZOOM_OAUTH_CONFIG.clientSecret), detail: "Zoom OAuth app." },
  ];
}

export async function runPreflightChecks(): Promise<PreflightReport> {
  const categories = [
    await checkDatabase(),
    checkAuthentication(),
    checkEncryption(),
    checkQueue(),
    checkCron(),
    checkWorkers(),
    checkStorage(),
    checkObservability(),
  ];

  return {
    environment: process.env.NODE_ENV || "development",
    generatedAt: new Date().toISOString(),
    categories,
    tenantIntegrations: checkTenantIntegrations(),
    overallOk: categories.every((c) => c.status !== "critical"),
  };
}
