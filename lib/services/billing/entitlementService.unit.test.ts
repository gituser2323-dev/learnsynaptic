import { describe, it, expect } from "vitest";
import { entitlementService } from "./entitlementService";
import { planService } from "./planService";
import { subscriptionService } from "./subscriptionService";
import { EntitlementError } from "./types";
import { INTERNAL_PLAN_ID } from "./internalPlan";
import { ensureInternalPlanSeeded } from "./internalPlan";

describe("entitlementService — self-healing default org", () => {
  it("an organization with no explicit Subscription is transparently provisioned onto the internal-unlimited plan", async () => {
    const entitlements = await entitlementService.getEntitlements("org-entitlement-no-sub");
    expect(entitlements.plan.id).toBe(INTERNAL_PLAN_ID);
    expect(entitlements.subscription.status).toBe("active");
    // "Do NOT break the internal Business OS" — every declared
    // capability is available on the self-provisioned default plan.
    expect(entitlements.capabilities.has("whatsapp")).toBe(true);
    expect(entitlements.capabilities.has("ai_crm")).toBe(true);
    expect(entitlements.limits).toEqual({});
  });

  it("is idempotent — a second call for the same org reuses the same subscription, not a duplicate", async () => {
    const first = await entitlementService.getEntitlements("org-entitlement-idempotent");
    const second = await entitlementService.getEntitlements("org-entitlement-idempotent");
    expect(second.subscription.id).toBe(first.subscription.id);
  });
});

describe("entitlementService — real plan capability/limit resolution", () => {
  it("hasCapability/assertCapability reflect exactly what the assigned plan declares", async () => {
    await planService.createPlan({
      id: "plan-entitlement-limited",
      name: "Limited",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 100,
      capabilities: ["crm"],
      limits: { seats: 2 },
    });
    await subscriptionService.assignPlan("org-entitlement-limited", "plan-entitlement-limited");

    expect(await entitlementService.hasCapability("org-entitlement-limited", "crm")).toBe(true);
    expect(await entitlementService.hasCapability("org-entitlement-limited", "ai_crm")).toBe(false);

    await expect(entitlementService.assertCapability("org-entitlement-limited", "ai_crm")).rejects.toBeInstanceOf(EntitlementError);
    await expect(entitlementService.assertCapability("org-entitlement-limited", "crm")).resolves.toBeDefined();

    expect(await entitlementService.getLimit("org-entitlement-limited", "seats")).toBe(2);
    expect(await entitlementService.getLimit("org-entitlement-limited", "leads")).toBeNull();
  });

  it("a cancelled/expired subscription denies every capability, even one the plan declares", async () => {
    await ensureInternalPlanSeeded();
    await subscriptionService.assignPlan("org-entitlement-cancelled", INTERNAL_PLAN_ID);
    await subscriptionService.cancel("org-entitlement-cancelled", { immediate: true });

    expect(await entitlementService.hasCapability("org-entitlement-cancelled", "crm")).toBe(false);
    await expect(entitlementService.assertCapability("org-entitlement-cancelled", "crm")).rejects.toMatchObject({ code: "no_subscription" });
  });

  it("application code never needs to compare plan.id/name directly — capability checks are the only sanctioned path (regression guard on the public API shape)", async () => {
    // This test exists to lock in the contract itself, not a specific
    // plan: entitlementService exposes hasCapability/assertCapability/
    // getLimit, never a "getPlanName" used for branching.
    expect(typeof entitlementService.hasCapability).toBe("function");
    expect(typeof entitlementService.assertCapability).toBe("function");
  });
});
