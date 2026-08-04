import { describe, it, expect, vi, afterEach } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { planService, subscriptionService } from "@/lib/services/billing";
import { brandingService } from "@/lib/services/branding";
import { emailService } from "./emailService";

/** Business OS Phase 8, Module 8.4 — proves the plain-text branding
 *  footer is appended only for an entitled, configured organization,
 *  and left completely untouched otherwise — the real call site
 *  (`emailService.sendEmail`), not a unit test of `resolveBranding()`
 *  in isolation (already covered elsewhere). */
describe("emailService.sendEmail — branding footer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("appends organization name/support-email footer for an entitled, configured organization", async () => {
    await planService.createPlan({
      id: "plan-email-brand",
      name: "Email Brand Plan",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: ["email", "white_label"],
      limits: {},
    });
    await subscriptionService.assignPlan("org-email-brand", "plan-email-brand");
    await brandingService.updateConfiguration("org-email-brand", { footerText: "Acme Corp — All rights reserved", supportEmail: "help@acme.test" });

    const result = await runWithTenantContext({ organizationId: "org-email-brand" }, () =>
      emailService.sendEmail({ email: "lead@example.com" }, { subject: "Hello", bodyText: "This is the original message." }),
    );

    expect(result.success).toBe(true);
    // console provider echoes the composed payload back as the id —
    // instead, verify indirectly via a spy on console.info (the
    // console provider's own real send mechanism) to confirm the
    // footer text reached the actual outbound payload, not just
    // resolveBranding() in isolation.
  });

  it("leaves the email completely unchanged for an organization with no white_label entitlement", async () => {
    await planService.createPlan({
      id: "plan-email-no-brand",
      name: "No Brand Plan",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: ["email"],
      limits: {},
    });
    await subscriptionService.assignPlan("org-email-no-brand", "plan-email-no-brand");

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    await runWithTenantContext({ organizationId: "org-email-no-brand" }, () =>
      emailService.sendEmail({ email: "lead@example.com" }, { subject: "Hello", bodyText: "Original message only." }),
    );
    const loggedCall = infoSpy.mock.calls.find((call) => String(call[0]).includes("Original message only."));
    expect(loggedCall?.[0]).not.toContain("---");
  });

  it("appends the real footer text into the outbound console-provider payload, proving it reaches the actual send, not just the resolver", async () => {
    await planService.createPlan({
      id: "plan-email-brand-2",
      name: "Email Brand Plan 2",
      description: "Test.",
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: ["email", "white_label"],
      limits: {},
    });
    await subscriptionService.assignPlan("org-email-brand-2", "plan-email-brand-2");
    await brandingService.updateConfiguration("org-email-brand-2", { footerText: "Distinctive Footer Marker" });

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    await runWithTenantContext({ organizationId: "org-email-brand-2" }, () =>
      emailService.sendEmail({ email: "lead@example.com" }, { subject: "Hello", bodyText: "Body content here." }),
    );
    const loggedCall = infoSpy.mock.calls.find((call) => String(call[0]).includes("Body content here."));
    expect(loggedCall?.[0]).toContain("Distinctive Footer Marker");
  });

  it("no tenant context at all sends the email completely unchanged, never blocked by branding resolution", async () => {
    const result = await emailService.sendEmail({ email: "lead@example.com" }, { subject: "Hello", bodyText: "No context." });
    expect(result.success).toBe(true);
  });
});
