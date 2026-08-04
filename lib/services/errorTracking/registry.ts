import { ERROR_TRACKING_ACTIVE_PROVIDER } from "@/config/errorTracking";
import { disabledErrorTrackingProvider } from "./providers/disabled.provider";
import { webhookErrorTrackingProvider } from "./providers/webhook.provider";
import type { ErrorTrackingProvider } from "./types";
import type { ErrorTrackingProviderId } from "@/config/errorTracking";

/** The single seam where ERROR_TRACKING_PROVIDER becomes a concrete
 *  ErrorTrackingProvider instance — the same shape virusScan's own
 *  registry.ts already established. errorTrackingService.ts is the
 *  only caller. */
const registry: Record<ErrorTrackingProviderId, ErrorTrackingProvider> = {
  disabled: disabledErrorTrackingProvider,
  webhook: webhookErrorTrackingProvider,
};

export function getErrorTrackingProvider(): ErrorTrackingProvider {
  return registry[ERROR_TRACKING_ACTIVE_PROVIDER];
}
