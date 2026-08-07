import {
  getUserRepository,
  getOrganizationRepository,
  getPaymentRepository,
  getAuditLogRepository,
  getIntegrationConnectionRepository,
} from "@/lib/db";
import { subscriptionService, planService } from "@/lib/services/billing";
import type { Plan } from "@/lib/services/billing";
import { getQueueMetrics } from "@/lib/services/scheduler";
import type { QueueMetrics } from "@/lib/services/scheduler";
import { runPreflightChecks } from "@/lib/services/systemHealth/preflightService";
import type { PreflightReport } from "@/lib/services/systemHealth/preflightService";
import { runCrossTenantSweep } from "@/lib/tenancy/context";
import type { AuditLogEntry } from "@/lib/db";
import type { IntegrationConnection } from "@/lib/services/integrations/types";

const FAILED_PAYMENTS_WINDOW_HOURS = 24;
const RECENT_SECURITY_EVENTS_LIMIT = 10;

export interface McrByCurrency {
  currency: string;
  /** Smallest currency unit (paise/cents) — same convention
   *  `Plan.basePriceInSmallestUnit` already uses, never a floated
   *  decimal. Yearly plans are normalized to a monthly figure
   *  (annual price / 12); one_time and internal plans are excluded
   *  entirely — neither is recurring revenue. */
  mrrInSmallestUnit: number;
  /** How many active-or-trialing subscriptions contributed to this
   *  currency's figure — lets the UI show "estimated from N
   *  subscriptions" rather than a bare, unexplained number. */
  subscriptionCount: number;
}

export interface PlatformDashboardSnapshot {
  generatedAt: string;
  organizations: {
    total: number;
    active: number;
    suspended: number;
  };
  subscriptions: {
    trialing: number;
    active: number;
    pastDue: number;
    cancelled: number;
    expired: number;
  };
  /** Real, provider-price-derived, but an ESTIMATE: computed from each
   *  active/trialing subscription's assigned Plan price, not from
   *  actual processed payments (a customer's real charge could differ
   *  — proration, manual discounts applied at the provider, currency
   *  conversion). Labelled as such in the UI, never presented as
   *  audited revenue. */
  estimatedMrr: McrByCurrency[];
  totalPlatformUsers: number;
  /** Real, provider-agnostic: count of Payment rows with
   *  status:"failed" created within the last 24 hours, across every
   *  organization. */
  failedPaymentsLast24h: number;
  platformHealth: PreflightReport;
  queueHealth: QueueMetrics;
  /** Real: IntegrationConnection rows with health:"error" AND
   *  enabled:true, across every organization — a connection an
   *  organization is actively relying on that is currently broken.
   *  Disabled/never-connected integrations are not "failures". */
  criticalIntegrationFailures: number;
  recentSecurityEvents: AuditLogEntry[];
}

function isRecurringPlan(plan: Plan): boolean {
  return plan.billingInterval === "monthly" || plan.billingInterval === "yearly";
}

function monthlyPriceInSmallestUnit(plan: Plan): number {
  return plan.billingInterval === "yearly" ? Math.round(plan.basePriceInSmallestUnit / 12) : plan.basePriceInSmallestUnit;
}

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console: the platform
 * console's own dashboard, built from REAL data sources only — never a
 * fabricated/placeholder number. Every field's own doc comment above
 * states exactly how it's derived and any estimation involved.
 *
 * Every query against a tenant-scoped collection (Payment, AuditLog,
 * IntegrationConnection, Subscription) runs inside
 * `runCrossTenantSweep()` — without it, these would silently scope to
 * whichever single organization the calling platform operator's own
 * token happens to carry (see tenantScopePlugin.ts's own doc comment),
 * making the dashboard show one tenant's data instead of the whole
 * deployment's.
 */
export async function getPlatformDashboardSnapshot(): Promise<PlatformDashboardSnapshot> {
  const organizationRepository = await getOrganizationRepository();
  const userRepository = await getUserRepository();

  const [totalResult, activeResult, suspendedResult, activeUsers, platformHealth, schedulerQueueHealth] = await Promise.all([
    organizationRepository.list({}, 1, 1),
    organizationRepository.list({ status: "active" }, 1, 1),
    organizationRepository.list({ status: "suspended" }, 1, 1),
    userRepository.listActive(),
    runPreflightChecks(),
    getQueueMetrics(),
  ]);

  const subscriptions = await runCrossTenantSweep(() => subscriptionService.listAllForScheduler());
  const subscriptionCounts = { trialing: 0, active: 0, pastDue: 0, cancelled: 0, expired: 0 };
  const mrrByCurrency = new Map<string, { mrrInSmallestUnit: number; subscriptionCount: number }>();

  const planCache = new Map<string, Plan | null>();
  async function getCachedPlan(planId: string): Promise<Plan | null> {
    if (!planCache.has(planId)) planCache.set(planId, await planService.getPlan(planId));
    return planCache.get(planId) ?? null;
  }

  for (const subscription of subscriptions) {
    switch (subscription.status) {
      case "trialing":
        subscriptionCounts.trialing++;
        break;
      case "active":
        subscriptionCounts.active++;
        break;
      case "past_due":
        subscriptionCounts.pastDue++;
        break;
      case "cancelled":
        subscriptionCounts.cancelled++;
        break;
      case "expired":
        subscriptionCounts.expired++;
        break;
      default:
        break;
    }

    if (subscription.status !== "active" && subscription.status !== "trialing") continue;
    const plan = await getCachedPlan(subscription.planId);
    if (!plan || !isRecurringPlan(plan) || plan.basePriceInSmallestUnit <= 0) continue;

    const entry = mrrByCurrency.get(plan.currency) ?? { mrrInSmallestUnit: 0, subscriptionCount: 0 };
    entry.mrrInSmallestUnit += monthlyPriceInSmallestUnit(plan);
    entry.subscriptionCount += 1;
    mrrByCurrency.set(plan.currency, entry);
  }

  const failedPaymentsSince = new Date(Date.now() - FAILED_PAYMENTS_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const [failedPayments, integrationConnections, securityEvents] = await runCrossTenantSweep(async () => {
    const paymentRepository = await getPaymentRepository();
    const integrationConnectionRepository = await getIntegrationConnectionRepository();
    const auditLogRepository = await getAuditLogRepository();
    return Promise.all([
      paymentRepository.list({ status: "failed", createdAfter: failedPaymentsSince }, 1, 1),
      integrationConnectionRepository.list(),
      auditLogRepository.list({ category: "security" }, 1, RECENT_SECURITY_EVENTS_LIMIT),
    ]);
  });

  const criticalIntegrationFailures = (integrationConnections as IntegrationConnection[]).filter(
    (connection) => connection.enabled && connection.health === "error",
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    organizations: { total: totalResult.total, active: activeResult.total, suspended: suspendedResult.total },
    subscriptions: subscriptionCounts,
    estimatedMrr: Array.from(mrrByCurrency.entries()).map(([currency, v]) => ({ currency, ...v })),
    totalPlatformUsers: activeUsers.length,
    failedPaymentsLast24h: failedPayments.total,
    platformHealth,
    queueHealth: schedulerQueueHealth,
    criticalIntegrationFailures,
    recentSecurityEvents: securityEvents.items,
  };
}
