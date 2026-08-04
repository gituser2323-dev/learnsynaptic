import { ERROR_TRACKING_WEBHOOK_CONFIG } from "@/config/errorTracking";
import { OUTBOUND_WEBHOOK_TIMEOUT_MS } from "@/lib/net/timeouts";
import { createLogger } from "@/lib/logger";
import type { ErrorTrackingProvider, ErrorTrackingContext } from "../types";

const logger = createLogger({ service: "errorTracking.webhook" });

/**
 * RC-3 — real, working, vendor-neutral error delivery: one JSON POST
 * per captured exception to ERROR_TRACKING_WEBHOOK_URL. Deliberately
 * NOT a specific vendor's proprietary ingestion protocol (see
 * config/errorTracking.ts's own doc comment for why) — any collector
 * that accepts a JSON POST can sit behind this URL, the same posture
 * this app's own notification providers (Slack/Discord/Teams) don't
 * take (those DO speak each vendor's specific payload shape, because
 * "post a message to a specific channel" has no vendor-neutral
 * equivalent) but which fits error *ingestion* well, since nothing
 * about this event shape is Sentry/Datadog/PagerDuty-specific.
 *
 * Never throws — a delivery failure is logged locally and swallowed,
 * matching this file's own interface contract (see types.ts). An error
 * that couldn't be reported to the external tracker must never become
 * a SECOND, different error that crashes the original caller.
 */
export const webhookErrorTrackingProvider: ErrorTrackingProvider = {
  id: "webhook",
  async captureException(error: unknown, context: ErrorTrackingContext): Promise<void> {
    if (!ERROR_TRACKING_WEBHOOK_CONFIG.url) {
      logger.error("error_tracking.misconfigured", {
        message: "ERROR_TRACKING_PROVIDER=webhook but ERROR_TRACKING_WEBHOOK_URL is blank — falling back to local log only.",
        capturedMessage: error instanceof Error ? error.message : String(error),
        ...context,
      });
      return;
    }

    const body = {
      service: ERROR_TRACKING_WEBHOOK_CONFIG.serviceName,
      environment: ERROR_TRACKING_WEBHOOK_CONFIG.environment,
      timestamp: new Date().toISOString(),
      severity: context.severity ?? "error",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    };

    try {
      const response = await fetch(ERROR_TRACKING_WEBHOOK_CONFIG.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(OUTBOUND_WEBHOOK_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.error("error_tracking.delivery_rejected", { status: response.status, operation: context.operation });
      }
    } catch (deliveryError) {
      logger.error("error_tracking.delivery_failed", {
        message: deliveryError instanceof Error ? deliveryError.message : String(deliveryError),
        operation: context.operation,
      });
    }
  },
};
