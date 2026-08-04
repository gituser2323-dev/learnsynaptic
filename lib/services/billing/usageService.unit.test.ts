import { describe, it, expect } from "vitest";
import { usageService, currentBillingPeriod } from "./usageService";
import { planService } from "./planService";
import { subscriptionService } from "./subscriptionService";
import { EntitlementError } from "./types";

describe("usageService — basic increment/check", () => {
  it("incrementUsage accumulates and getUsage reads it back", async () => {
    const org = "org-usage-basic";
    await usageService.incrementUsage(org, "leads", 3);
    await usageService.incrementUsage(org, "leads", 2);
    expect(await usageService.getUsage(org, "leads")).toBe(5);
  });

  it("checkAndIncrementUsage allows usage under an unlimited (null) limit and keeps incrementing", async () => {
    await planService.createPlan({
      id: "plan-usage-unlimited",
      name: "Unlimited",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: {},
    });
    await subscriptionService.assignPlan("org-usage-unlimited", "plan-usage-unlimited");

    const first = await usageService.checkAndIncrementUsage("org-usage-unlimited", "whatsapp_messages", 500);
    expect(first).toEqual({ allowed: true, current: 500, limit: null });
  });

  it("checkAndIncrementUsage denies and rolls back the increment once the limit is exceeded", async () => {
    await planService.createPlan({
      id: "plan-usage-limited",
      name: "Limited",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: { whatsapp_messages: 3 },
    });
    await subscriptionService.assignPlan("org-usage-limited", "plan-usage-limited");

    const a = await usageService.checkAndIncrementUsage("org-usage-limited", "whatsapp_messages");
    const b = await usageService.checkAndIncrementUsage("org-usage-limited", "whatsapp_messages");
    const c = await usageService.checkAndIncrementUsage("org-usage-limited", "whatsapp_messages");
    expect([a.allowed, b.allowed, c.allowed]).toEqual([true, true, true]);

    const d = await usageService.checkAndIncrementUsage("org-usage-limited", "whatsapp_messages");
    expect(d.allowed).toBe(false);
    expect(d.current).toBe(3);
    expect(d.limit).toBe(3);
    // The rejected attempt's own increment was rolled back — the real
    // persisted counter still reads 3, not 4.
    expect(await usageService.getUsage("org-usage-limited", "whatsapp_messages")).toBe(3);
  });

  it("assertWithinLimit throws EntitlementError('limit_exceeded') instead of returning allowed:false", async () => {
    await planService.createPlan({
      id: "plan-usage-assert",
      name: "Limited",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: { ai_requests: 1 },
    });
    await subscriptionService.assignPlan("org-usage-assert", "plan-usage-assert");

    await usageService.assertWithinLimit("org-usage-assert", "ai_requests");
    await expect(usageService.assertWithinLimit("org-usage-assert", "ai_requests")).rejects.toBeInstanceOf(EntitlementError);
  });

  it("usage is scoped per organizationId+metric+period — never bleeds across organizations or metrics", async () => {
    await usageService.incrementUsage("org-usage-scope-a", "leads", 10);
    await usageService.incrementUsage("org-usage-scope-b", "leads", 1);
    await usageService.incrementUsage("org-usage-scope-a", "whatsapp_messages", 99);

    expect(await usageService.getUsage("org-usage-scope-a", "leads")).toBe(10);
    expect(await usageService.getUsage("org-usage-scope-b", "leads")).toBe(1);
    expect(await usageService.getUsage("org-usage-scope-a", "whatsapp_messages")).toBe(99);
    expect(await usageService.getUsage("org-usage-scope-b", "whatsapp_messages")).toBe(0);
  });

  it("currentBillingPeriod returns a stable YYYY-MM string", () => {
    const period = currentBillingPeriod(new Date("2026-03-15T10:00:00Z"));
    expect(period).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("usageService — concurrency safety", () => {
  it("a hard limit cannot be trivially bypassed by simultaneous requests racing the last available slot", async () => {
    await planService.createPlan({
      id: "plan-usage-race",
      name: "Race",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: { whatsapp_messages: 5 },
    });
    await subscriptionService.assignPlan("org-usage-race", "plan-usage-race");

    // 20 concurrent "send a message" attempts against a limit of 5 —
    // fired via Promise.all so their underlying repository calls
    // genuinely interleave across microtask boundaries (real
    // concurrency in Node's single-threaded event loop), not a
    // sequential loop that could never expose a read-then-write race.
    const attempts = await Promise.all(Array.from({ length: 20 }, () => usageService.checkAndIncrementUsage("org-usage-race", "whatsapp_messages")));

    const allowedCount = attempts.filter((a) => a.allowed).length;
    const deniedCount = attempts.filter((a) => !a.allowed).length;
    expect(allowedCount).toBe(5);
    expect(deniedCount).toBe(15);

    // The real persisted counter converges to exactly the limit, never
    // over it (a broken read-then-write implementation would let some
    // denied attempts' increments "stick," pushing this above 5) and
    // never under it (a broken rollback would leave it below 5).
    expect(await usageService.getUsage("org-usage-race", "whatsapp_messages")).toBe(5);
  });

  it("30 concurrent requests against a limit of 1 admit exactly one winner", async () => {
    await planService.createPlan({
      id: "plan-usage-race-one",
      name: "Race One",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: { ai_requests: 1 },
    });
    await subscriptionService.assignPlan("org-usage-race-one", "plan-usage-race-one");

    const attempts = await Promise.all(Array.from({ length: 30 }, () => usageService.checkAndIncrementUsage("org-usage-race-one", "ai_requests")));
    expect(attempts.filter((a) => a.allowed).length).toBe(1);
    expect(await usageService.getUsage("org-usage-race-one", "ai_requests")).toBe(1);
  });
});
