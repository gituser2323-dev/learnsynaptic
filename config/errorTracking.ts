/**
 * RC-3 — Reliability, Queues & Observability: Error Tracking / APM.
 * Single source of truth for provider selection, the same "one env var
 * picks the active adapter" shape config/virusScan.ts / config/storage.ts
 * already established.
 *
 * Defaults to "disabled" — no error-tracking vendor account exists in
 * this environment to verify a hand-rolled vendor-specific integration
 * against (the same disclosed-honesty posture virusScan's own "clamav"
 * vs "disabled" choice already takes). "webhook" is the one real,
 * working provider: a generic HTTP POST of a structured error event to
 * any operator-configured collector URL — deliberately NOT a specific
 * vendor's proprietary ingestion protocol (Sentry's envelope format,
 * Datadog's APM wire protocol, etc.), so this integration is never
 * hardcoded to one observability vendor (the mission's own explicit
 * instruction) and works with any endpoint that accepts a JSON POST —
 * a custom collector, an incident-management platform's Events API, or
 * a log-ingestion service.
 */

export type ErrorTrackingProviderId = "disabled" | "webhook";

const SUPPORTED_PROVIDER_IDS: readonly ErrorTrackingProviderId[] = ["disabled", "webhook"];

function resolveActiveProvider(): ErrorTrackingProviderId {
  const raw = process.env.ERROR_TRACKING_PROVIDER;
  if (raw && (SUPPORTED_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as ErrorTrackingProviderId;
  }
  return "disabled";
}

export const ERROR_TRACKING_ACTIVE_PROVIDER: ErrorTrackingProviderId = resolveActiveProvider();

export const ERROR_TRACKING_WEBHOOK_CONFIG = {
  url: process.env.ERROR_TRACKING_WEBHOOK_URL || "",
  serviceName: process.env.ERROR_TRACKING_SERVICE_NAME || "learnsynaptic",
  environment: process.env.NODE_ENV || "development",
};
