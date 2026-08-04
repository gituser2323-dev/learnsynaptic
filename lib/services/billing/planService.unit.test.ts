import { describe, it, expect } from "vitest";
import { planService } from "./planService";

describe("planService", () => {
  it("creates a plan with real capabilities and limits, defaulting status to draft and version to 1", async () => {
    const result = await planService.createPlan({
      id: "plan-a-test",
      name: "Plan A",
      description: "Limited plan for testing.",
      billingInterval: "monthly",
      currency: "inr",
      basePriceInSmallestUnit: 99900,
      capabilities: ["crm", "whatsapp"],
      limits: { seats: 3, leads: 100 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.version).toBe(1);
    expect(result.data.currency).toBe("INR");
    expect(result.data.capabilities).toEqual(["crm", "whatsapp"]);
    expect(result.data.limits).toEqual({ seats: 3, leads: 100 });
  });

  it("rejects a duplicate plan id", async () => {
    await planService.createPlan({
      id: "plan-dup-test",
      name: "Dup",
      description: "Dup plan.",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: {},
    });
    const second = await planService.createPlan({
      id: "plan-dup-test",
      name: "Dup 2",
      description: "Dup plan.",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: {},
    });
    expect(second.success).toBe(false);
    if (!second.success) expect(second.error.code).toBe("duplicate");
  });

  it("rejects an unknown capability id", async () => {
    const result = await planService.createPlan({
      id: "plan-bad-cap-test",
      name: "Bad",
      description: "Bad plan.",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: ["not_a_real_capability" as never],
      limits: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("validation");
  });

  it("rejects an unknown usage metric in limits, and a negative limit", async () => {
    const badMetric = await planService.createPlan({
      id: "plan-bad-limit-test",
      name: "Bad",
      description: "Bad plan.",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: { not_a_real_metric: 5 } as never,
    });
    expect(badMetric.success).toBe(false);

    const negative = await planService.createPlan({
      id: "plan-neg-limit-test",
      name: "Bad",
      description: "Bad plan.",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: { seats: -1 },
    });
    expect(negative.success).toBe(false);
  });

  it("updates a plan and bumps its version, never resetting other fields", async () => {
    await planService.createPlan({
      id: "plan-update-test",
      name: "Original",
      description: "Original.",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 100,
      capabilities: ["crm"],
      limits: { seats: 1 },
    });
    const updated = await planService.updatePlan("plan-update-test", { name: "Renamed" });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.name).toBe("Renamed");
    expect(updated.data.version).toBe(2);
    expect(updated.data.capabilities).toEqual(["crm"]);
    expect(updated.data.limits).toEqual({ seats: 1 });
  });

  it("returns not_found for updating a nonexistent plan", async () => {
    const result = await planService.updatePlan("plan-does-not-exist", { name: "X" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("not_found");
  });

  it("null in limits means explicitly unlimited, distinct from an absent key", async () => {
    const result = await planService.createPlan({
      id: "plan-unlimited-test",
      name: "Unlimited seats",
      description: "Test.",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: { seats: null, leads: 50 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.limits.seats).toBeNull();
    expect(result.data.limits.leads).toBe(50);
    expect("whatsapp_messages" in result.data.limits).toBe(false);
  });
});
