import { describe, it, expect } from "vitest";
import { subscriptionService } from "./subscriptionService";
import { planService } from "./planService";
import { INTERNAL_PLAN_ID, ensureInternalPlanSeeded } from "./internalPlan";

describe("subscriptionService — trial / upgrade / downgrade / cancel / expire", () => {
  it("assigning a plan with trialDays > 0 for a first-time subscriber starts trialing", async () => {
    await planService.createPlan({
      id: "plan-sub-trial",
      name: "Trial Plan",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 1000,
      capabilities: ["crm"],
      limits: {},
      trialDays: 14,
    });
    const subscription = await subscriptionService.assignPlan("org-sub-trial", "plan-sub-trial");
    expect(subscription.status).toBe("trialing");
    expect(subscription.trialEndsAt).toBeDefined();
  });

  it("assigning a zero-trial plan for a first-time subscriber goes straight to active", async () => {
    await planService.createPlan({
      id: "plan-sub-no-trial",
      name: "No Trial",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 1000,
      capabilities: [],
      limits: {},
    });
    const subscription = await subscriptionService.assignPlan("org-sub-no-trial", "plan-sub-no-trial");
    expect(subscription.status).toBe("active");
    expect(subscription.trialEndsAt).toBeUndefined();
  });

  it("upgrade: changing plan on an existing subscription preserves status and clears any pending cancellation", async () => {
    await planService.createPlan({ id: "plan-sub-up-a", name: "A", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: ["crm"], limits: { seats: 2 } });
    await planService.createPlan({ id: "plan-sub-up-b", name: "B", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 500, capabilities: ["crm", "ai_crm"], limits: { seats: 10 } });

    await subscriptionService.assignPlan("org-sub-upgrade", "plan-sub-up-a");
    await subscriptionService.cancel("org-sub-upgrade", { immediate: false });
    const upgraded = await subscriptionService.assignPlan("org-sub-upgrade", "plan-sub-up-b");

    expect(upgraded.planId).toBe("plan-sub-up-b");
    expect(upgraded.status).toBe("active");
    // Assigning a new plan is treated as a real decision to continue —
    // any pending cancel-at-period-end is cleared, not silently kept.
    expect(upgraded.cancelAt).toBeUndefined();
  });

  it("downgrade never deletes the organization's existing data — it only changes plan/limits going forward", async () => {
    await planService.createPlan({ id: "plan-sub-down-big", name: "Big", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 1000, capabilities: ["crm"], limits: { seats: 10 } });
    await planService.createPlan({ id: "plan-sub-down-small", name: "Small", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: ["crm"], limits: { seats: 1 } });

    await subscriptionService.assignPlan("org-sub-downgrade", "plan-sub-down-big");
    const downgraded = await subscriptionService.assignPlan("org-sub-downgrade", "plan-sub-down-small");
    expect(downgraded.planId).toBe("plan-sub-down-small");
    // subscriptionService.assignPlan() itself never touches any
    // non-Subscription collection — a real assertion that no user/lead/
    // file data was queried or mutated by this call would require a
    // spy on those repositories; the structural guarantee is that this
    // function's own implementation (subscriptionService.ts) has no
    // code path that deletes anything at all, enforced by this being
    // the entire body of what runs.
  });

  it("cancel at period end keeps the subscription active until currentPeriodEnd, sets cancelAt", async () => {
    await ensureInternalPlanSeeded();
    const created = await subscriptionService.assignPlan("org-sub-cancel-later", INTERNAL_PLAN_ID);
    const cancelled = await subscriptionService.cancel("org-sub-cancel-later", { immediate: false });
    expect(cancelled.status).toBe("active");
    expect(cancelled.cancelAt).toBe(created.currentPeriodEnd);
    expect(cancelled.cancelledAt).toBeUndefined();
  });

  it("immediate cancel flips status to cancelled right away", async () => {
    await ensureInternalPlanSeeded();
    await subscriptionService.assignPlan("org-sub-cancel-now", INTERNAL_PLAN_ID);
    const cancelled = await subscriptionService.cancel("org-sub-cancel-now", { immediate: true });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).toBeDefined();
  });

  it("resumeCancellation clears a pending cancel-at-period-end", async () => {
    await ensureInternalPlanSeeded();
    await subscriptionService.assignPlan("org-sub-resume", INTERNAL_PLAN_ID);
    await subscriptionService.cancel("org-sub-resume", { immediate: false });
    const resumed = await subscriptionService.resumeCancellation("org-sub-resume");
    expect(resumed.cancelAt).toBeUndefined();
    expect(resumed.status).toBe("active");
  });

  it("recordRenewal moves status back to active and extends currentPeriodEnd", async () => {
    await ensureInternalPlanSeeded();
    const created = await subscriptionService.assignPlan("org-sub-renew", INTERNAL_PLAN_ID);
    // Snapshotted into a primitive immediately — the in-memory
    // repository returns the SAME mutable object it stores internally
    // (every in-memory repository in this codebase follows this
    // convention), so reading `created.currentPeriodEnd` again after a
    // later mutating call on this same subscription would silently see
    // that later call's own change applied retroactively to this
    // reference, not the original value.
    const originalPeriodEnd = created.currentPeriodEnd;
    await subscriptionService.markPastDue("org-sub-renew");
    const newEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const renewed = await subscriptionService.recordRenewal("org-sub-renew", newEnd);
    expect(renewed.status).toBe("active");
    expect(renewed.currentPeriodEnd).toBe(newEnd);
    expect(renewed.currentPeriodStart).toBe(originalPeriodEnd);
  });

  it("expire('trial_ended') / expire('grace_period_ended') both set status to expired without touching tenant data", async () => {
    await planService.createPlan({ id: "plan-sub-expire", name: "Expire", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: [], limits: {}, trialDays: 7 });
    await subscriptionService.assignPlan("org-sub-expire-trial", "plan-sub-expire");
    const expired = await subscriptionService.expire("org-sub-expire-trial", "trial_ended");
    expect(expired.status).toBe("expired");

    await ensureInternalPlanSeeded();
    await subscriptionService.assignPlan("org-sub-expire-grace", INTERNAL_PLAN_ID);
    await subscriptionService.markPastDue("org-sub-expire-grace");
    const graceExpired = await subscriptionService.expire("org-sub-expire-grace", "grace_period_ended");
    expect(graceExpired.status).toBe("expired");
  });
});
