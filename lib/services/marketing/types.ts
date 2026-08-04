/**
 * Marketing Dashboard domain layer — architecture only (Module 8).
 *
 * Three independent provider abstractions, the same dependency-inversion
 * shape as lib/services/whatsapp: the application layer (funnels.ts,
 * campaignMetrics.ts) depends only on these interfaces, never on a
 * specific vendor SDK.
 *
 *  - AdsProvider     — paid ad spend/impressions/clicks (Meta Ads today;
 *                       shaped generically enough for Google Ads later).
 *  - WebAnalyticsProvider — site traffic (Google Analytics / GA4).
 *  - RevenueProvider — paid-student revenue. No third-party vendor to
 *                       name here: this is a seam for the future Payments
 *                       module (ARCHITECTURE.md: "not started"), not an
 *                       external integration.
 *
 * Every metrics shape carries a `dataAvailable` flag rather than silently
 * defaulting numeric fields to 0. Those are not the same claim: "0 ad
 * spend" asserts a fact about the world, "dataAvailable: false" says the
 * fact is unknown because no provider is connected yet. Collapsing the
 * two would let a disconnected dashboard misreport real numbers as zero.
 */

export interface DateRange {
  /** ISO date, inclusive. */
  from: string;
  /** ISO date, inclusive. */
  to: string;
}

// ─── Ads (Meta Ads) ──────────────────────────────────────────────────────

export type AdsProviderId = "none" | "meta-ads";

export interface AdMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  currency: string;
  dataAvailable: boolean;
}

export interface AdsProvider {
  readonly id: AdsProviderId;
  /** externalCampaignId is Campaign.externalAdCampaignId (lib/db) —
   *  undefined queries account-wide spend. */
  getMetrics(externalCampaignId: string | undefined, range: DateRange): Promise<AdMetrics>;
}

// ─── Web analytics (Google Analytics) ───────────────────────────────────

export type WebAnalyticsProviderId = "none" | "google-analytics";

export interface WebAnalyticsMetrics {
  sessions: number;
  users: number;
  pageViews: number;
  dataAvailable: boolean;
}

export interface WebAnalyticsProvider {
  readonly id: WebAnalyticsProviderId;
  getMetrics(range: DateRange): Promise<WebAnalyticsMetrics>;
}

// ─── Revenue (no Payments module exists yet) ────────────────────────────

export interface RevenueMetrics {
  totalRevenueInr: number;
  paidStudentCount: number;
  dataAvailable: boolean;
}

export interface RevenueProvider {
  getMetrics(range: DateRange): Promise<RevenueMetrics>;
}

// ─── Derived ad-performance metrics (pure functions live in metrics.ts) ─

export interface DerivedAdMetrics {
  /** clicks / impressions. */
  ctr: number | null;
  /** spend / clicks. */
  cpc: number | null;
  /** spend / conversions (registrations). */
  cpa: number | null;
  /** revenue / spend. Null whenever revenue data is unavailable. */
  roas: number | null;
}

// ─── Funnels ─────────────────────────────────────────────────────────────

export interface LeadFunnel {
  /** From WebAnalyticsProvider (sessions). Null if unavailable. */
  visitors: number | null;
  leads: number;
  visitorToLeadRate: number | null;
}

export interface ConversionFunnel {
  leads: number;
  registrations: number;
  leadToRegistrationRate: number | null;
}

export interface RevenueFunnel {
  registrations: number;
  /** From RevenueProvider. Null if unavailable — see the module doc above. */
  paidStudents: number | null;
  totalRevenueInr: number | null;
  registrationToPaidRate: number | null;
}

// ─── Campaign-level and account-level marketing metrics ────────────────

export interface CampaignMarketingMetrics {
  campaignId: string;
  campaignName: string;
  registrations: number;
  ads: AdMetrics;
  derived: DerivedAdMetrics;
}

export interface OverallMarketingMetrics {
  totalAdSpend: number;
  totalImpressions: number;
  totalClicks: number;
  adDataAvailable: boolean;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
}
