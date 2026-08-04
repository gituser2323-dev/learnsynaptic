/**
 * Thrown by any Ads/WebAnalytics provider adapter that's scaffolded but
 * not yet integrated with its real API — same role as
 * lib/services/whatsapp/errors.ts's WhatsAppProviderNotImplementedError.
 *
 * Callers in this module (funnels.ts, campaignMetrics.ts) catch this and
 * degrade the affected section to "data unavailable" rather than let it
 * propagate — a misconfigured/unintegrated ad or analytics provider
 * should not take down the rest of the dashboard.
 */
export class MarketingProviderNotImplementedError extends Error {
  constructor(providerId: string) {
    super(
      `Marketing provider "${providerId}" is scaffolded but not yet integrated. ` +
        `See lib/services/marketing/providers/${providerId}.provider.ts for the ` +
        `integration checklist, or leave the provider unset to use the "none" ` +
        `placeholder (reports dataAvailable: false instead of failing).`,
    );
    this.name = "MarketingProviderNotImplementedError";
  }
}
