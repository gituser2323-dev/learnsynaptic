import { planService } from "./planService";
import { subscriptionService } from "./subscriptionService";
import { ACTIVE_SUBSCRIPTION_STATUSES, EntitlementError } from "./types";
import type { EntitlementDetails, PlanCapability, UsageMetric } from "./types";

/**
 * Business OS Phase 8, Module 8.3 — the ONE place plan/subscription
 * state becomes a yes/no answer to "can this organization do X right
 * now." Every server-side enforcement point in this app (route-level
 * `requiredCapability`, a service calling `assertCapability` directly)
 * goes through this module — the mission's own explicit "avoid
 * feature-check logic scattered throughout the application."
 * Application code must never compare `plan.id`/`plan.name` directly;
 * see this file's own `hasCapability`/`assertCapability` as the only
 * sanctioned check.
 */
export const entitlementService = {
  async getEntitlements(organizationId: string): Promise<EntitlementDetails> {
    const subscription = await subscriptionService.getForOrganization(organizationId);
    const plan = await planService.getPlan(subscription.planId);
    if (!plan) {
      // A Subscription referencing a Plan id that no longer exists (an
      // archived/deleted plan) is a real, disclosed edge case — fail
      // closed (no capabilities, no limits) rather than throw a raw
      // 500 into every route that resolves entitlements.
      throw new EntitlementError("no_subscription", `Subscription references unknown plan "${subscription.planId}".`, { organizationId, planId: subscription.planId });
    }
    return {
      organizationId,
      plan,
      subscription,
      capabilities: new Set(plan.capabilities),
      limits: plan.limits,
    };
  },

  async hasCapability(organizationId: string, capability: PlanCapability): Promise<boolean> {
    const entitlements = await this.getEntitlements(organizationId);
    if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(entitlements.subscription.status)) return false;
    return entitlements.capabilities.has(capability);
  },

  /** The server-enforcement primitive — throws `EntitlementError`
   *  (`"capability_denied"`) rather than returning a boolean, so a
   *  caller that forgets to check the return value can't accidentally
   *  proceed. Hiding a button is a UX nicety layered on top of this,
   *  never a substitute for it. */
  async assertCapability(organizationId: string, capability: PlanCapability): Promise<EntitlementDetails> {
    const entitlements = await this.getEntitlements(organizationId);
    if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(entitlements.subscription.status)) {
      throw new EntitlementError("no_subscription", `Organization's subscription is ${entitlements.subscription.status}, not active.`, {
        organizationId,
        status: entitlements.subscription.status,
      });
    }
    if (!entitlements.capabilities.has(capability)) {
      throw new EntitlementError("capability_denied", `Your current plan ("${entitlements.plan.name}") does not include this feature.`, {
        organizationId,
        capability,
        planId: entitlements.plan.id,
      });
    }
    return entitlements;
  },

  /** `null` = unlimited (either explicitly, or the metric is simply
   *  absent from the plan's own limits map — see types.ts's own doc
   *  comment on why absence means unlimited, never zero). */
  async getLimit(organizationId: string, metric: UsageMetric): Promise<number | null> {
    const entitlements = await this.getEntitlements(organizationId);
    return entitlements.limits[metric] ?? null;
  },
};
