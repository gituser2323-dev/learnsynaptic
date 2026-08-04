import type {
  DateRange,
  RevenueMetrics,
  RevenueGrowth,
  RevenueTrendPoint,
  CrmFunnelResult,
  RevenueAttributionResult,
  CounsellorRevenueResult,
  CampaignRoiResult,
  WhatsAppRevenueResult,
} from "@/lib/services/revenueAnalytics";
import type { AutomationAnalyticsSummary, WorkflowPerformanceResult } from "@/lib/services/automation/analytics";

export type { DateRange };

/**
 * Enterprise Analytics (Phase 7), module 7.3 — Executive Dashboard,
 * Action Center domain layer.
 *
 * Deliberately NOT a second notification/alerting engine — every
 * category here is a thin composition over an EXISTING list/read
 * operation this app already has (taskService.listTasks,
 * leadService.listLeads, pipelineService.listOpportunities, the
 * Payment repository's own list(), 7.2's own getWorkflowPerformance(),
 * whatsappCampaignService.getOverallMessageStats(),
 * webhookService.listEndpoints(), integrationService.listIntegrations()).
 * The only genuinely new logic is "stalled opportunity" (see
 * actionCenterService.ts's own STALLED_THRESHOLD_DAYS) — everything
 * else is a real, already-queryable filter, not a fabricated signal.
 */
export type ActionCenterCategory =
  | "overdueTasks"
  | "hotLeads"
  | "stalledOpportunities"
  | "failedPayments"
  | "failedWhatsAppMessages"
  | "failedAutomations"
  | "webhookFailures"
  | "integrationHealthIssues";

export interface ActionCenterItemPreview {
  id: string;
  /** The record's own display name/title. */
  label: string;
  /** One line of real, relevant context (e.g. "Due 3 days ago",
   *  "₹5,000 · razorpay", "12 consecutive failures"). */
  detail: string;
  /** Where clicking this specific item navigates. Points at the
   *  record's own detail page where one exists (Leads); the owning
   *  list page otherwise (this app's Tasks/Payments/Pipeline pages
   *  don't yet support per-record deep links or URL-driven filters —
   *  a real, disclosed limitation, not silently worked around). */
  href: string;
}

export interface ActionCenterCategoryResult {
  category: ActionCenterCategory;
  label: string;
  /** Total count matching this category — may exceed items.length. */
  count: number;
  /** Where "View all" for this category navigates. */
  href: string;
  /** Up to 5 real, most-relevant records. */
  items: ActionCenterItemPreview[];
}

export interface ActionCenterResult {
  range: DateRange;
  /** Sum of every category's own count — the one number for "how much
   *  needs my attention right now," shown as a badge. */
  totalCount: number;
  categories: ActionCenterCategoryResult[];
}

/**
 * Executive Summary domain layer — the KPI Layer, Sales Funnel drill-in,
 * WhatsApp Health, and Payment Health sections of the Executive
 * Dashboard (mission's own §"EXECUTIVE KPI LAYER"/"WHATSAPP HEALTH"/
 * "PAYMENT HEALTH"). Revenue Overview, Counsellor Performance, and
 * Campaign Performance are NOT re-typed here — the dashboard composes
 * Module 7.2's own `RevenueMetrics`/`RevenueGrowth`/`CrmFunnelResult`/
 * `RevenueAttributionResult`/`CounsellorRevenueResult`/`CampaignRoiResult`/
 * `AutomationAnalyticsSummary`/`WorkflowPerformanceResult` verbatim (see
 * executiveSummaryService.ts) — this file only adds the handful of
 * fields no existing module already computes.
 */
export interface ExecutiveKpis {
  range: DateRange;
  /** = funnel's own "leadsCreated" stage count for the same range —
   *  not a second lead query. */
  totalLeadsInRange: number;
  /** Live snapshot (unscoped by range, the same convention 1.6's own
   *  openTasksCount and Action Center's own hot-leads count already
   *  use): Leads currently banded "hot" or "warm" by
   *  lib/services/crm/scoring/health.ts's own bandHealth() — this app's
   *  LeadStatus enum has no literal "Qualified" value (the same gap
   *  CrmFunnelResult's own module doc already discloses for its
   *  funnel), so this is the one real, already-established proxy this
   *  data model supports, not a fabricated status. */
  qualifiedLeadsCount: number;
  /** = funnel's own "registrationsConfirmed" stage count for the same
   *  range. */
  conversionsInRange: number;
  /** = funnel's own "registrationsConfirmed" stage
   *  conversionFromFirstPct. */
  conversionRatePct: number | null;
  collectedRevenueInr: number;
  expectedRevenueInr: number;
  pipelineValueInr: number;
  avgDealValueInr: number | null;
  paymentSuccessRatePct: number | null;
  /** Live snapshots (unscoped by range — "how many deals are open/won/
   *  lost right now," the same shape openOpportunitiesCount already
   *  is), NOT the same figures as revenue.wonRevenueInr/lostRevenueInr
   *  above (those ARE range-scoped, by opportunity value not count) —
   *  deliberately not conflated into one KPI. */
  openOpportunitiesCount: number;
  wonOpportunitiesCount: number;
  lostOpportunitiesCount: number;
  activeWorkflowDefinitions: number;
  automationSuccessRatePct: number | null;
  whatsappDeliveryRatePct: number | null;
  whatsappReadRatePct: number | null;
  whatsappReplyRatePct: number | null;
}

/**
 * Account-wide WhatsApp Health (mission's own §"WHATSAPP HEALTH") — a
 * pure aggregation over `WhatsAppRevenueResult.campaigns` (already
 * fetched for Campaign Performance), never a second Message query.
 * Per that module's own disclosed nuance, sent/delivered/read/failed/
 * reply counts are WhatsAppCampaign's own all-time denormalized
 * rollups, not filtered to the selected date range — this aggregate
 * inherits that same disclosed scope rather than silently implying a
 * range-scoped total.
 */
export interface ExecutiveWhatsAppHealth {
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  replyCount: number;
  /** deliveredCount / sentCount, 0–100. Null if sentCount is 0. */
  deliveryRatePct: number | null;
  /** readCount / deliveredCount, 0–100. Null if deliveredCount is 0. */
  readRatePct: number | null;
  /** replyCount / deliveredCount, 0–100. Null if deliveredCount is 0. */
  replyRatePct: number | null;
}

/**
 * Account-wide Payment Health (mission's own §"PAYMENT HEALTH") — a
 * thin reshape of `paymentService.getAnalytics()` (Module 6.4, already
 * all-time/unscoped by its own design), not a second Payment query.
 */
export interface ExecutivePaymentHealth {
  succeededCount: number;
  failedCount: number;
  refundedCount: number;
  partiallyRefundedCount: number;
  totalTransactions: number;
  /** All-time succeeded-Payment revenue, INR only — see
   *  paymentService.getAnalytics()'s own succeededByCurrency disclosure
   *  for why non-INR is excluded here rather than force-summed.
   *  Deliberately distinct from ExecutiveKpis.collectedRevenueInr
   *  above, which IS range-scoped — never conflated into one figure. */
  allTimeCollectedRevenueInr: number;
  /** succeeded / (succeeded + failed), 0–100. Null if neither has
   *  happened yet. */
  paymentSuccessRatePct: number | null;
}

export interface ExecutiveDashboardResult {
  range: DateRange;
  kpis: ExecutiveKpis;
  revenue: RevenueMetrics;
  revenueGrowth: RevenueGrowth;
  /** Day-bucketed collected revenue — reused verbatim from Module 7.2's
   *  own getRevenueTrend(), not recomputed. */
  revenueTrend: RevenueTrendPoint[];
  funnel: CrmFunnelResult;
  attribution: RevenueAttributionResult;
  counsellors: CounsellorRevenueResult;
  campaignRoi: CampaignRoiResult;
  whatsapp: ExecutiveWhatsAppHealth;
  whatsappCampaigns: WhatsAppRevenueResult;
  automation: AutomationAnalyticsSummary;
  workflowPerformance: WorkflowPerformanceResult;
  payments: ExecutivePaymentHealth;
}
