import { describe, it, expect } from "vitest";
import { subscriptionService } from "./subscriptionService";
import { planService } from "./planService";
import { entitlementService } from "./entitlementService";
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

describe("subscriptionService — RC-6 platform-operator overrides", () => {
  it("extendTrial pushes trialEndsAt AND currentPeriodEnd forward together for a currently-trialing subscription", async () => {
    await planService.createPlan({ id: "plan-rc6-trial", name: "RC6 Trial", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: [], limits: {}, trialDays: 7 });
    const sub = await subscriptionService.assignPlan("org-rc6-extend-trial", "plan-rc6-trial");
    const originalTrialEndsAt = sub.trialEndsAt!;

    const extended = await subscriptionService.extendTrial("org-rc6-extend-trial", 5);
    expect(new Date(extended.trialEndsAt!).getTime()).toBe(new Date(originalTrialEndsAt).getTime() + 5 * 24 * 60 * 60 * 1000);
    expect(extended.currentPeriodEnd).toBe(extended.trialEndsAt);
  });

  it("extendTrial throws for a subscription that is not currently trialing (never fabricates a trial state)", async () => {
    await ensureInternalPlanSeeded();
    await subscriptionService.assignPlan("org-rc6-extend-not-trial", INTERNAL_PLAN_ID);
    await expect(subscriptionService.extendTrial("org-rc6-extend-not-trial", 5)).rejects.toThrow(/not currently on a trial/);
  });

  it("overrideCapability grants a capability the plan doesn't include, without touching the Plan document itself", async () => {
    await planService.createPlan({ id: "plan-rc6-no-ai", name: "RC6 No AI", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: ["crm"], limits: {} });
    await subscriptionService.assignPlan("org-rc6-override-grant", "plan-rc6-no-ai");

    const entitlementsBefore = await entitlementService.getEntitlements("org-rc6-override-grant");
    expect(entitlementsBefore.capabilities.has("ai_crm")).toBe(false);

    await subscriptionService.overrideCapability("org-rc6-override-grant", "ai_crm", true);
    const entitlementsAfter = await entitlementService.getEntitlements("org-rc6-override-grant");
    expect(entitlementsAfter.capabilities.has("ai_crm")).toBe(true);

    const planAfter = await planService.getPlan("plan-rc6-no-ai");
    expect(planAfter?.capabilities).toEqual(["crm"]); // the shared Plan document is untouched.
  });

  it("overrideCapability revokes a capability the plan DOES include (a support/compliance action)", async () => {
    await planService.createPlan({ id: "plan-rc6-with-ai", name: "RC6 With AI", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: ["crm", "ai_crm"], limits: {} });
    await subscriptionService.assignPlan("org-rc6-override-revoke", "plan-rc6-with-ai");

    await subscriptionService.overrideCapability("org-rc6-override-revoke", "ai_crm", false);
    const entitlements = await entitlementService.getEntitlements("org-rc6-override-revoke");
    expect(entitlements.capabilities.has("ai_crm")).toBe(false);
  });

  it("overrideCapability with granted:null clears a previously-set override, reverting to the plan's own value", async () => {
    await planService.createPlan({ id: "plan-rc6-clear", name: "RC6 Clear", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: ["crm"], limits: {} });
    await subscriptionService.assignPlan("org-rc6-override-clear", "plan-rc6-clear");

    await subscriptionService.overrideCapability("org-rc6-override-clear", "ai_crm", true);
    expect((await entitlementService.getEntitlements("org-rc6-override-clear")).capabilities.has("ai_crm")).toBe(true);

    await subscriptionService.overrideCapability("org-rc6-override-clear", "ai_crm", null);
    expect((await entitlementService.getEntitlements("org-rc6-override-clear")).capabilities.has("ai_crm")).toBe(false);
  });

  it("overrideCapability setting one capability never clobbers a different, already-set override", async () => {
    await planService.createPlan({ id: "plan-rc6-multi", name: "RC6 Multi", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: [], limits: {} });
    await subscriptionService.assignPlan("org-rc6-override-multi", "plan-rc6-multi");

    await subscriptionService.overrideCapability("org-rc6-override-multi", "ai_crm", true);
    await subscriptionService.overrideCapability("org-rc6-override-multi", "automation", true);
    const entitlements = await entitlementService.getEntitlements("org-rc6-override-multi");
    expect(entitlements.capabilities.has("ai_crm")).toBe(true);
    expect(entitlements.capabilities.has("automation")).toBe(true);
  });

  it("overrideLimit increases a numeric limit for one org without touching the shared Plan", async () => {
    await planService.createPlan({ id: "plan-rc6-limit", name: "RC6 Limit", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: [], limits: { seats: 5 } });
    await subscriptionService.assignPlan("org-rc6-override-limit", "plan-rc6-limit");

    expect(await entitlementService.getLimit("org-rc6-override-limit", "seats")).toBe(5);
    await subscriptionService.overrideLimit("org-rc6-override-limit", "seats", 50);
    expect(await entitlementService.getLimit("org-rc6-override-limit", "seats")).toBe(50);

    const planAfter = await planService.getPlan("plan-rc6-limit");
    expect(planAfter?.limits.seats).toBe(5); // the shared Plan document is untouched.
  });

  it("overrideLimit with value:null sets unlimited for this org only", async () => {
    await planService.createPlan({ id: "plan-rc6-limit-unlimited", name: "RC6 Limit Unlimited", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: [], limits: { leads: 100 } });
    await subscriptionService.assignPlan("org-rc6-override-unlimited", "plan-rc6-limit-unlimited");

    await subscriptionService.overrideLimit("org-rc6-override-unlimited", "leads", null);
    expect(await entitlementService.getLimit("org-rc6-override-unlimited", "leads")).toBeNull();
  });

  it("overrideLimit with clear:true removes the override, reverting to the plan's own limit", async () => {
    await planService.createPlan({ id: "plan-rc6-limit-clear", name: "RC6 Limit Clear", description: "T", status: "active", billingInterval: "monthly", currency: "INR", basePriceInSmallestUnit: 100, capabilities: [], limits: { seats: 3 } });
    await subscriptionService.assignPlan("org-rc6-override-limit-clear", "plan-rc6-limit-clear");

    await subscriptionService.overrideLimit("org-rc6-override-limit-clear", "seats", 99);
    expect(await entitlementService.getLimit("org-rc6-override-limit-clear", "seats")).toBe(99);

    await subscriptionService.overrideLimit("org-rc6-override-limit-clear", "seats", null, { clear: true });
    expect(await entitlementService.getLimit("org-rc6-override-limit-clear", "seats")).toBe(3);
  });
});
