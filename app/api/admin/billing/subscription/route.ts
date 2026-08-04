import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import { getTenantContext } from "@/lib/tenancy/context";
import { entitlementService } from "@/lib/services/billing";

/**
 * GET /api/admin/billing/subscription
 *
 * Business OS Phase 8, Module 8.3 — the current organization's own
 * subscription, plan, resolved capabilities, and limits — the one
 * read the admin Billing UI needs. Self-healing: an organization with
 * no explicit Subscription yet (including LearnSynaptic's own default
 * org) transparently resolves onto the internal-unlimited plan rather
 * than erroring (see entitlementService.getEntitlements()'s own doc
 * comment).
 *
 * ⚠️ requiredRole: "manager" — visibility into billing status/usage is
 * a manager-tier concern (the same floor 1.6's Leaderboard and 7.x
 * Analytics already use), not counsellor-visible, not requiring full
 * admin just to VIEW (mutation routes below are admin-only).
 */
async function handleGetSubscription(): Promise<NextResponse> {
  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) throw new UnauthorizedApiError();
  const entitlements = await entitlementService.getEntitlements(organizationId);
  return apiSuccess({
    subscription: entitlements.subscription,
    plan: entitlements.plan,
    capabilities: [...entitlements.capabilities],
  });
}

export const GET = withApiRoute("admin.billing.subscription.get", handleGetSubscription, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
