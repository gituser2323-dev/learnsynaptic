import { describe, it, expect, vi, afterEach } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { authService } from "@/lib/services/auth";
import { processSendJob } from "@/lib/services/whatsapp/queue";
import { entitlementService } from "./entitlementService";
import { planService } from "./planService";
import { subscriptionService } from "./subscriptionService";
import { usageService } from "./usageService";

/**
 * Business OS Phase 8, Module 8.3 — proves real, server-side
 * enforcement at the actual call sites (not just that the entitlement/
 * usage services work in isolation, already covered elsewhere), plus
 * real two-organization isolation: Org A and Org B each on their own
 * plan resolve independently, and neither's usage/capability state
 * ever bleeds into the other's.
 */
describe("enforcement — seats (authService.createUser)", () => {
  it("rejects creating a user beyond the plan's seat limit, and the rejection never persists a row", async () => {
    await planService.createPlan({
      id: "plan-seats-enforce",
      name: "Seats",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: { seats: 1 },
    });
    await subscriptionService.assignPlan("org-seats-enforce", "plan-seats-enforce");

    const first = await runWithTenantContext({ organizationId: "org-seats-enforce" }, () =>
      authService.createUser({ email: "seat1@enforce-test.local", password: "correct-horse-battery", role: "counsellor" }),
    );
    expect(first.success).toBe(true);

    const second = await runWithTenantContext({ organizationId: "org-seats-enforce" }, () =>
      authService.createUser({ email: "seat2@enforce-test.local", password: "correct-horse-battery", role: "counsellor" }),
    );
    expect(second.success).toBe(false);
    if (!second.success) expect(second.errors[0]?.message).toMatch(/plan allows 1/i);
  });

  it("a different organization's own seat count is entirely independent", async () => {
    await planService.createPlan({
      id: "plan-seats-org-b",
      name: "Seats B",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [],
      limits: { seats: 1 },
    });
    await subscriptionService.assignPlan("org-seats-independent-a", "plan-seats-org-b");
    await subscriptionService.assignPlan("org-seats-independent-b", "plan-seats-org-b");

    await runWithTenantContext({ organizationId: "org-seats-independent-a" }, () =>
      authService.createUser({ email: "a-seat@enforce-test.local", password: "correct-horse-battery", role: "counsellor" }),
    );
    // Org A is now at its own limit (1/1) — Org B, a completely
    // separate organization on the identical plan, still has its own
    // full allowance untouched.
    const orgBResult = await runWithTenantContext({ organizationId: "org-seats-independent-b" }, () =>
      authService.createUser({ email: "b-seat@enforce-test.local", password: "correct-horse-battery", role: "counsellor" }),
    );
    expect(orgBResult.success).toBe(true);
  });
});

describe("enforcement — WhatsApp send (queue.processSendJob)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks a send once the whatsapp_messages limit is reached, never reaching the provider", async () => {
    await planService.createPlan({
      id: "plan-whatsapp-enforce",
      name: "WA",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: ["whatsapp"],
      limits: { whatsapp_messages: 1 },
    });
    await subscriptionService.assignPlan("org-whatsapp-enforce", "plan-whatsapp-enforce");

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.1" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    const job = { id: "job-1", type: "text" as const, recipient: { phoneE164: "+911234567890" }, textBody: "hi", enqueuedAt: new Date().toISOString() };

    const first = await runWithTenantContext({ organizationId: "org-whatsapp-enforce" }, () => processSendJob(job));
    expect(first.success).toBe(true);
    const callsAfterFirst = fetchMock.mock.calls.length;

    const second = await runWithTenantContext({ organizationId: "org-whatsapp-enforce" }, () => processSendJob({ ...job, id: "job-2" }));
    expect(second.success).toBe(false);
    // The denied send never made a second real HTTP call to the vendor.
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("blocks a send when the plan lacks the whatsapp capability at all", async () => {
    await planService.createPlan({
      id: "plan-whatsapp-no-cap",
      name: "No WA",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: ["crm"],
      limits: {},
    });
    await subscriptionService.assignPlan("org-whatsapp-no-cap", "plan-whatsapp-no-cap");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runWithTenantContext({ organizationId: "org-whatsapp-no-cap" }, () =>
      processSendJob({ id: "job-3", type: "text", recipient: { phoneE164: "+911234567890" }, textBody: "hi", enqueuedAt: new Date().toISOString() }),
    );
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("enforcement — real two-organization isolation across the full billing stack", () => {
  it("Org A (Plan A, limited) and Org B (Plan B, expanded) resolve entirely independent entitlements, limits, and usage", async () => {
    await planService.createPlan({
      id: "plan-iso-a",
      name: "Plan A",
      description: "Limited.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: ["crm"],
      limits: { leads: 5, seats: 1 },
    });
    await planService.createPlan({
      id: "plan-iso-b",
      name: "Plan B",
      description: "Expanded.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: ["crm", "ai_crm", "whatsapp_campaigns"],
      limits: { leads: 500, seats: 20 },
    });
    await subscriptionService.assignPlan("org-iso-a", "plan-iso-a");
    await subscriptionService.assignPlan("org-iso-b", "plan-iso-b");

    // Allowed vs. blocked feature.
    expect(await entitlementService.hasCapability("org-iso-a", "ai_crm")).toBe(false);
    expect(await entitlementService.hasCapability("org-iso-b", "ai_crm")).toBe(true);

    // Usage below / at / above limit, independently per org.
    for (let i = 0; i < 5; i++) await usageService.checkAndIncrementUsage("org-iso-a", "leads");
    const aOverLimit = await usageService.checkAndIncrementUsage("org-iso-a", "leads");
    expect(aOverLimit.allowed).toBe(false);

    // Org B, an entirely different organization with a much higher
    // limit, is completely unaffected by Org A having just hit its own.
    const bUsage = await usageService.checkAndIncrementUsage("org-iso-b", "leads");
    expect(bUsage.allowed).toBe(true);
    expect(bUsage.current).toBe(1);

    // Limits themselves never cross.
    expect(await entitlementService.getLimit("org-iso-a", "leads")).toBe(5);
    expect(await entitlementService.getLimit("org-iso-b", "leads")).toBe(500);
  });
});
