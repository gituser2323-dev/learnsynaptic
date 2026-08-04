import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import { getTenantContext } from "@/lib/tenancy/context";
import { getUserRepository } from "@/lib/db";
import { usageService, entitlementService, USAGE_METRICS, currentBillingPeriod, LIFETIME_USAGE_PERIOD } from "@/lib/services/billing";
import type { UsageMetric } from "@/lib/services/billing";

/** Metrics that are STOCK (current level, not per-period) — see
 *  usageService.ts's own `LIFETIME_USAGE_PERIOD` doc comment. Read
 *  from the lifetime bucket instead of the current calendar month. */
const LIFETIME_METRICS: readonly UsageMetric[] = ["storage_bytes"];

/**
 * GET /api/admin/billing/usage
 *
 * Business OS Phase 8, Module 8.3 — every metered metric's current
 * usage against the organization's plan limit, for the Billing UI's
 * own usage/progress display. Reads the SAME persisted counters
 * `usageService.checkAndIncrementUsage()` writes — never recomputed by
 * counting another collection (see usageService.ts's own doc comment).
 *
 * ⚠️ requiredRole: "manager" — same visibility tier as
 * GET .../subscription.
 */
async function handleGetUsage(): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();

  const period = currentBillingPeriod();
  const userRepository = await getUserRepository();
  const activeUsers = await userRepository.listActive();

  const usage = await Promise.all(
    USAGE_METRICS.map(async (metric) => {
      const limit = await entitlementService.getLimit(organizationId, metric);
      // "seats" is a live headcount (see authService.createUser()'s own
      // doc comment on why it's never routed through the period-scoped
      // usage counters), not a persisted counter — computed the same
      // way the enforcement check itself does, so this display can
      // never drift from what's actually enforced.
      if (metric === "seats") {
        const current = activeUsers.filter((u) => u.organizationId === organizationId).length;
        return { metric, current, limit, period: "current" };
      }
      const isLifetime = LIFETIME_METRICS.includes(metric);
      const current = await usageService.getUsage(organizationId, metric, isLifetime ? LIFETIME_USAGE_PERIOD : period);
      return { metric, current, limit, period: isLifetime ? LIFETIME_USAGE_PERIOD : period };
    }),
  );

  return apiSuccess({ usage });
}

export const GET = withApiRoute("admin.billing.usage.get", handleGetUsage, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
