import { describe, it, expect } from "vitest";
import { getBrandConfigurationRepository } from "@/lib/db";
import { planService, subscriptionService } from "@/lib/services/billing";
import { brandingService } from "./brandingService";
import { resolveBranding, invalidateBrandingCache } from "./themeResolver";

/**
 * Business OS Phase 8, Module 8.4 — the mission's own explicit "cache
 * keys MUST include tenant identity... verify cache invalidation after
 * branding updates" requirement, proven directly rather than assumed
 * from `themeResolver.ts`'s own design.
 */
describe("themeResolver cache — tenant isolation and real invalidation", () => {
  it("changing Organization A's branding never affects Organization B's own cached/resolved branding", async () => {
    await planService.createPlan({
      id: "plan-cache-iso",
      name: "Cache Isolation Plan",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: ["white_label"],
      limits: {},
    });
    await subscriptionService.assignPlan("org-cache-a", "plan-cache-iso");
    await subscriptionService.assignPlan("org-cache-b", "plan-cache-iso");

    await brandingService.updateConfiguration("org-cache-a", { displayName: "Org A Brand", accentColor: "#15803d" });
    await brandingService.updateConfiguration("org-cache-b", { displayName: "Org B Brand", accentColor: "#7c3aed" });

    const brandingA = await resolveBranding("org-cache-a");
    const brandingB = await resolveBranding("org-cache-b");
    expect(brandingA.displayName).toBe("Org A Brand");
    expect(brandingB.displayName).toBe("Org B Brand");
    expect(brandingA.cssVariables["--adm-accent"]).toBe("#15803d");
    expect(brandingB.cssVariables["--adm-accent"]).toBe("#7c3aed");

    // Change Org A again — Org B's own already-cached entry must stay
    // exactly what it was, proven by re-reading it a second time.
    await brandingService.updateConfiguration("org-cache-a", { displayName: "Org A Brand — renamed" });
    const brandingAAfter = await resolveBranding("org-cache-a");
    const brandingBAfter = await resolveBranding("org-cache-b");
    expect(brandingAAfter.displayName).toBe("Org A Brand — renamed");
    expect(brandingBAfter.displayName).toBe("Org B Brand");
    expect(brandingBAfter.cssVariables["--adm-accent"]).toBe("#7c3aed");
  });

  it("a resolve is genuinely cached (a direct repository write with no invalidation is NOT reflected), and invalidateBrandingCache() makes the next resolve fresh", async () => {
    await planService.createPlan({
      id: "plan-cache-ttl",
      name: "Cache TTL Plan",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: ["white_label"],
      limits: {},
    });
    await subscriptionService.assignPlan("org-cache-ttl", "plan-cache-ttl");
    await brandingService.updateConfiguration("org-cache-ttl", { displayName: "Cached Name" });

    const firstResolve = await resolveBranding("org-cache-ttl");
    expect(firstResolve.displayName).toBe("Cached Name");

    // Bypass brandingService's own invalidation on purpose, to prove
    // the cache is real (not accidentally a no-op / always-fresh read).
    const repo = await getBrandConfigurationRepository();
    await repo.upsert("org-cache-ttl", { displayName: "Changed Behind The Cache's Back" });

    const stillCached = await resolveBranding("org-cache-ttl");
    expect(stillCached.displayName).toBe("Cached Name");

    invalidateBrandingCache("org-cache-ttl");
    const freshAfterInvalidate = await resolveBranding("org-cache-ttl");
    expect(freshAfterInvalidate.displayName).toBe("Changed Behind The Cache's Back");
  });
});
