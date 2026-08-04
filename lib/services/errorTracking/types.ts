import type { ErrorTrackingProviderId } from "@/config/errorTracking";

/**
 * RC-3 — safe metadata only, the exact field set the mission's own
 * "structured logging" section names (timestamp/severity/requestId/
 * correlationId/organizationId/userId/jobId/workflowRunId/campaignId/
 * provider/operation) — never passwords/OTPs/tokens/API secrets/
 * payment secrets. Every caller of errorTrackingService.captureException
 * is expected to pass only these fields, never a raw request/response
 * body or credential payload.
 */
export interface ErrorTrackingContext {
  requestId?: string;
  correlationId?: string;
  organizationId?: string;
  userId?: string;
  jobId?: string;
  jobType?: string;
  workflowRunId?: string;
  campaignId?: string;
  /** The vendor/integration this failure originated from — "whatsapp",
   *  "stripe", "openai", etc. — for the mission's own "per-domain
   *  failure counts" style grouping at the tracking backend. */
  provider?: string;
  /** A short, stable operation name — "scheduler.job_failed",
   *  "api.unhandled_error" — never a full stack trace or free-form
   *  message (the error object itself already carries that). */
  operation?: string;
  route?: string;
  severity?: "error" | "warning";
}

export interface ErrorTrackingProvider {
  readonly id: ErrorTrackingProviderId;
  /** MUST NOT throw — reporting an error must never itself become a new
   *  source of failure for the caller. Every provider implementation is
   *  responsible for catching its own delivery failures internally (see
   *  disabled.provider.ts / webhook.provider.ts for the pattern);
   *  errorTrackingService.ts's own wrapper is a second, defensive layer
   *  on top of that, not a substitute for it. */
  captureException(error: unknown, context: ErrorTrackingContext): Promise<void>;
}
