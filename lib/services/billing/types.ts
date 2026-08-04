import type { PaginatedResult } from "@/lib/pagination";

/**
 * Business OS Phase 8, Module 8.3 — Billing, Plans & Feature Flags.
 * The commercial entitlement layer: Organization -> Subscription ->
 * Plan -> Entitlements -> Usage Limits -> Feature Access. This file is
 * the one place every capability/metric name is declared — application
 * code checks `hasCapability(orgId, "whatsapp_campaigns")`, never
 * `plan.id === "pro"`, per the mission's own explicit "do NOT hardcode
 * business logic directly to plan names" instruction.
 */

/**
 * Every gate-able feature area in the app today, plus one named future
 * one (`white_label`, Module 8.4 — registered here so a future module
 * only adds a real check, not a new capability name). Deliberately a
 * closed union, not a free string: a typo in a capability name must be
 * a compile error, not a silently-always-false check.
 */
export type PlanCapability =
  | "crm"
  | "whatsapp"
  | "whatsapp_campaigns"
  | "whatsapp_embedded_signup"
  | "automation"
  | "ai_crm"
  | "email"
  | "analytics"
  | "integrations"
  | "file_storage"
  | "calendar"
  | "payments"
  | "webhooks"
  | "team_members"
  | "white_label";

export const PLAN_CAPABILITIES: readonly PlanCapability[] = [
  "crm",
  "whatsapp",
  "whatsapp_campaigns",
  "whatsapp_embedded_signup",
  "automation",
  "ai_crm",
  "email",
  "analytics",
  "integrations",
  "file_storage",
  "calendar",
  "payments",
  "webhooks",
  "team_members",
  "white_label",
];

/**
 * Every plan-limitable usage quantity. Deliberately no separate
 * "contacts" metric alongside "leads" — this app's own data model has
 * no distinct Contact entity (a Lead already IS the one contact
 * record), so a second metric here would be a fabricated distinction,
 * not a real one; `leads` covers it. `seats` is real users
 * (`UserRepository.list`'s own count), never a fabricated concept.
 */
export type UsageMetric =
  | "seats"
  | "leads"
  | "whatsapp_messages"
  | "whatsapp_campaign_sends"
  | "automation_executions"
  | "ai_requests"
  | "storage_bytes"
  | "integrations"
  | "webhook_deliveries";

export const USAGE_METRICS: readonly UsageMetric[] = [
  "seats",
  "leads",
  "whatsapp_messages",
  "whatsapp_campaign_sends",
  "automation_executions",
  "ai_requests",
  "storage_bytes",
  "integrations",
  "webhook_deliveries",
];

export type PlanStatus = "active" | "archived" | "draft";

/** `"internal"` — a zero-price, non-billed interval for the
 *  self-provisioned default/internal plan (see entitlementService's own
 *  doc comment) — deliberately distinct from `"one_time"` (a real
 *  future one-off-purchase plan) so a real revenue report can exclude
 *  internal/grandfathered orgs by interval alone, no name matching. */
export type BillingInterval = "monthly" | "yearly" | "one_time" | "internal";

/** `null` = unlimited; a metric absent from the map is also unlimited
 *  (the same "absence means no restriction" default every plan's own
 *  limits object uses) — never treated as zero. */
export type PlanLimits = Partial<Record<UsageMetric, number | null>>;

export interface Plan {
  id: string;
  name: string;
  description: string;
  status: PlanStatus;
  billingInterval: BillingInterval;
  currency: string;
  basePriceInSmallestUnit: number;
  capabilities: PlanCapability[];
  limits: PlanLimits;
  /** 0 = no trial. */
  trialDays: number;
  metadata?: Record<string, string>;
  /** Incremented on every edit — entitlements always resolve against
   *  the CURRENT plan document (never a frozen snapshot on the
   *  Subscription), so `version` is provenance/audit information
   *  ("which edit of this plan was active when X happened", surfaced in
   *  audit log metadata), not a resolution key. A future module that
   *  needs true frozen-at-subscribe-time entitlements would read this
   *  field to detect drift — deliberately not built speculatively now. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanInput {
  id: string;
  name: string;
  description: string;
  status?: PlanStatus;
  billingInterval: BillingInterval;
  currency: string;
  basePriceInSmallestUnit: number;
  capabilities: PlanCapability[];
  limits: PlanLimits;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface UpdatePlanInput {
  name?: string;
  description?: string;
  status?: PlanStatus;
  billingInterval?: BillingInterval;
  currency?: string;
  basePriceInSmallestUnit?: number;
  capabilities?: PlanCapability[];
  limits?: PlanLimits;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface PlanRepository {
  findById(id: string): Promise<Plan | null>;
  list(): Promise<Plan[]>;
  create(input: CreatePlanInput): Promise<Plan>;
  update(id: string, input: UpdatePlanInput): Promise<Plan>;
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "suspended" | "expired";

/** Which statuses count as "the organization currently has access" —
 *  the one place this policy is decided, so entitlementService and any
 *  future billing UI never disagree on it. */
export const ACTIVE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ["trialing", "active", "past_due"];

/** A pointer to whatever real-money mechanism backs this subscription,
 *  when one exists — reuses Module 6.4's own `PaymentProviderId`
 *  concept by string reference (not importing the type here, to avoid
 *  a billing<->payments circular import) rather than inventing a
 *  second provider-id concept. Absent entirely for the self-provisioned
 *  internal plan (no real money involved). */
export interface SubscriptionProviderRef {
  provider: string;
  customerId?: string;
  /** The vendor-side recurring-subscription id, when a real recurring
   *  billing integration exists for this provider (see this module's
   *  own disclosed "no real auto-charge recurring billing" gap — none
   *  of the 3 real Module 6.4 gateways are wired for one yet). */
  subscriptionId?: string;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  /** Set = will move to `cancelled` at this timestamp (cancel-at-period-
   *  end); the subscription stays fully active/usable until then. */
  cancelAt?: string;
  /** Set = already cancelled (either immediate, or `cancelAt` was
   *  reached). Distinct from `cancelAt` so "scheduled to cancel" and
   *  "already cancelled" are never conflated. */
  cancelledAt?: string;
  providerRef?: SubscriptionProviderRef;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionInput {
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  providerRef?: SubscriptionProviderRef;
  metadata?: Record<string, string>;
}

export interface UpdateSubscriptionInput {
  planId?: string;
  status?: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  cancelAt?: string | null;
  cancelledAt?: string;
  providerRef?: SubscriptionProviderRef;
  metadata?: Record<string, string>;
}

export interface SubscriptionRepository {
  findByOrganizationId(organizationId: string): Promise<Subscription | null>;
  create(input: CreateSubscriptionInput): Promise<Subscription>;
  update(organizationId: string, input: UpdateSubscriptionInput): Promise<Subscription>;
  /** Cross-tenant sweep for the scheduler's own trial/period-rollover
   *  job — deliberately not tenant-scoped, the same `findDue`-style
   *  exception `WorkflowRun`/`Payment`/`ScheduledJob` already
   *  establish for background sweeps (see tenantScopePlugin.ts's own
   *  doc comment). */
  findAll(): Promise<Subscription[]>;
}

/**
 * Business OS Phase 8, Module 8.3 — a PLATFORM feature flag (e.g. "AI
 * feature X is being gradually rolled out"), deliberately a SEPARATE
 * concept from a plan's own `capabilities` array. A capability answers
 * "does this organization's PLAN include this feature commercially";
 * a feature flag answers "is this feature currently switched on for
 * this deployment/organization at all," independent of billing —
 * conflating the two would mean a platform-wide rollout toggle could
 * never be flipped without also editing every plan's own capability
 * list, and vice versa.
 */
export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  /** Per-organization override, checked before the global `enabled`
   *  default — lets a flag be off platform-wide but on for one pilot
   *  organization, or on platform-wide but off for one organization
   *  mid-incident. */
  organizationOverrides?: Record<string, boolean>;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeatureFlagInput {
  key: string;
  description: string;
  enabled?: boolean;
  metadata?: Record<string, string>;
}

export interface UpdateFeatureFlagInput {
  description?: string;
  enabled?: boolean;
  organizationOverrides?: Record<string, boolean>;
  metadata?: Record<string, string>;
}

export interface FeatureFlagRepository {
  findByKey(key: string): Promise<FeatureFlag | null>;
  list(): Promise<FeatureFlag[]>;
  create(input: CreateFeatureFlagInput): Promise<FeatureFlag>;
  update(key: string, input: UpdateFeatureFlagInput): Promise<FeatureFlag>;
}

/**
 * One row per (organizationId, metric, period) — a real, persisted,
 * atomically-incrementable counter, never derived by counting other
 * collections on every request (the mission's own explicit "avoid
 * expensive full-database counting on every request"). `period` is a
 * plain `"YYYY-MM"` calendar-month string, IST-anchored (this app's own
 * established timezone convention — see `lib/dateRanges.ts`) —
 * deliberately not a rolling 30-day window, the simplest correct
 * definition of "this billing period" for a monthly-interval plan.
 */
export interface UsageCounter {
  id: string;
  organizationId: string;
  metric: UsageMetric;
  period: string;
  count: number;
  createdAt: string;
  updatedAt: string;
}

export interface UsageCounterRepository {
  find(organizationId: string, metric: UsageMetric, period: string): Promise<UsageCounter | null>;
  listForOrganization(organizationId: string, period: string): Promise<UsageCounter[]>;
  /** Atomically applies `delta` to the (organizationId, metric, period)
   *  counter, creating it at `delta` if absent, and returns the
   *  resulting document — a single atomic operation
   *  (`findOneAndUpdate`+`$inc`+`upsert` in Mongo), the primitive
   *  usageService's own increment-then-compensate algorithm is built
   *  on. Never a separate read-then-write pair. */
  incrementAndGet(organizationId: string, metric: UsageMetric, period: string, delta: number): Promise<UsageCounter>;
}

export interface EntitlementDetails {
  organizationId: string;
  plan: Plan;
  subscription: Subscription;
  capabilities: Set<PlanCapability>;
  limits: PlanLimits;
}

/** Thrown by `entitlementService.assertCapability()`/
 *  `usageService.assertWithinLimit()` — the one exception type every
 *  server-side enforcement point in this module throws, so
 *  `withApiRoute.ts` and any manually-written service check can map it
 *  to a structured, consistent response (never a bare 500). */
export class EntitlementError extends Error {
  constructor(
    public readonly code: "no_subscription" | "capability_denied" | "limit_exceeded",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

export type { PaginatedResult };
