import type { AdsProviderId, WebAnalyticsProviderId } from "@/lib/services/marketing/types";

/**
 * Single source of truth for Marketing Dashboard provider selection and
 * credentials — same shape as config/whatsapp.ts.
 *
 * Deliberately NOT NEXT_PUBLIC_* — these are server-side reporting reads
 * (ad spend, GA4 aggregate metrics), not client-side tracking calls (that's
 * config/analytics.ts's job, a completely different concern: sending
 * events vs. reading back aggregated reports).
 *
 * Every credential is optional: an unset/invalid provider id falls back
 * to "none" (see lib/services/marketing/registry.ts), whose provider
 * returns dataAvailable: false rather than failing — the app never fails
 * to build or run just because no ad/analytics account is connected yet.
 */

const SUPPORTED_ADS_PROVIDER_IDS: readonly AdsProviderId[] = ["none", "meta-ads"];
const SUPPORTED_WEB_ANALYTICS_PROVIDER_IDS: readonly WebAnalyticsProviderId[] = ["none", "google-analytics"];

function resolveAdsProvider(): AdsProviderId {
  const raw = process.env.MARKETING_ADS_PROVIDER;
  if (raw && (SUPPORTED_ADS_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as AdsProviderId;
  }
  return "none";
}

function resolveWebAnalyticsProvider(): WebAnalyticsProviderId {
  const raw = process.env.MARKETING_WEB_ANALYTICS_PROVIDER;
  if (raw && (SUPPORTED_WEB_ANALYTICS_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as WebAnalyticsProviderId;
  }
  return "none";
}

export const MARKETING_ACTIVE_ADS_PROVIDER: AdsProviderId = resolveAdsProvider();
export const MARKETING_ACTIVE_WEB_ANALYTICS_PROVIDER: WebAnalyticsProviderId = resolveWebAnalyticsProvider();

/** Meta Marketing API (Ads Insights) — a different product, different
 *  token/permission scope, and different config namespace from
 *  config/whatsapp.ts's META_CLOUD_API_CONFIG (WhatsApp Cloud API). Both
 *  happen to be Meta products; neither credential works for the other. */
export const META_ADS_CONFIG = {
  accessToken: process.env.META_ADS_ACCESS_TOKEN || "",
  adAccountId: process.env.META_ADS_AD_ACCOUNT_ID || "",
  apiVersion: process.env.META_ADS_API_VERSION || "v21.0",
};

/** GA4 Data API (server-side reporting reads) — distinct from
 *  NEXT_PUBLIC_GA_MEASUREMENT_ID in config/analytics.ts, which is the
 *  client-side gtag.js measurement id used to *send* events. Reading
 *  aggregate reports back requires a GA4 property id plus a service
 *  account, not the public measurement id. */
export const GOOGLE_ANALYTICS_CONFIG = {
  propertyId: process.env.GOOGLE_ANALYTICS_PROPERTY_ID || "",
  serviceAccountEmail: process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL || "",
  serviceAccountPrivateKey: process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_PRIVATE_KEY || "",
};
