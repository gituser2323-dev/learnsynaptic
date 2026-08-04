import { createLogger } from "@/lib/logger";
import type { ErrorTrackingProvider, ErrorTrackingContext } from "../types";

const logger = createLogger({ service: "errorTracking.disabled" });
let hasWarned = false;

/**
 * RC-3 — the safe, always-available default: every captured exception
 * still reaches structured stdout/stderr logs (this app's real,
 * existing observability surface — see lib/logger.ts), just never
 * forwarded to an external tracker. Real (not a stub that throws),
 * matching virusScan's own "disabled" provider precedent — this app
 * must still function, and still be debuggable, with zero external
 * error-tracking account configured. Warns exactly once per process
 * (not once per error, which would flood logs) so an operator who
 * never configured a real provider has one clear, findable signal.
 */
export const disabledErrorTrackingProvider: ErrorTrackingProvider = {
  id: "disabled",
  async captureException(error: unknown, context: ErrorTrackingContext): Promise<void> {
    if (!hasWarned) {
      hasWarned = true;
      logger.warn("error_tracking.disabled", {
        message:
          "ERROR_TRACKING_PROVIDER is not configured — errors are only visible in structured logs, not forwarded to an external tracker. Set ERROR_TRACKING_PROVIDER=webhook (+ ERROR_TRACKING_WEBHOOK_URL) to enable.",
      });
    }
    logger.error("error_tracking.captured", {
      message: error instanceof Error ? error.message : String(error),
      ...context,
    });
  },
};
