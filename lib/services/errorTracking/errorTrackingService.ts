import { getErrorTrackingProvider } from "./registry";
import type { ErrorTrackingContext } from "./types";

export type { ErrorTrackingContext } from "./types";
export type { ErrorTrackingProviderId } from "@/config/errorTracking";

/**
 * RC-3 — the one entry point every call site uses (handleError.ts's
 * unhandled-API-error branch, schedulerService.ts's final job-failure
 * branch), regardless of which ErrorTrackingProvider is active —
 * mirrors virusScanService.ts's own single-entry-point shape.
 *
 * A second, defensive try/catch on top of each provider's own "must
 * not throw" contract (see types.ts) — error-reporting infrastructure
 * failing must never mask or replace the ORIGINAL error the caller was
 * already handling.
 */
export const errorTrackingService = {
  async captureException(error: unknown, context: ErrorTrackingContext = {}): Promise<void> {
    try {
      await getErrorTrackingProvider().captureException(error, context);
    } catch {
      // Deliberately swallowed — see this function's own doc comment.
    }
  },
};
