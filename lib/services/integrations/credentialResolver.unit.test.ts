import { describe, it, expect } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { integrationService } from "./integrationService";
import { resolveTenantCredential, resolveTenantCredentials } from "./credentialResolver";

/**
 * Business OS Phase 8, Module 8.2 — proves the resolver's own core
 * promise: each organization resolves only its own stored credential,
 * a missing credential resolves to `undefined` (never a thrown error,
 * never another org's value), and the lookup is driven entirely by the
 * `organizationId` argument, never by whatever AsyncLocalStorage
 * context happens to be ambient at the call site. Uses distinct
 * provider ids per test group to avoid interfering with other test
 * files sharing the same in-memory IntegrationConnection store.
 */
describe("credentialResolver — two-tenant isolation", () => {
  it("resolves each organization's own credential value for the same provider", async () => {
    await runWithTenantContext({ organizationId: "org-resolver-a" }, () => integrationService.setTenantCredentials("cloudinary", { apiKey: "org-a-key" }));
    await runWithTenantContext({ organizationId: "org-resolver-b" }, () => integrationService.setTenantCredentials("cloudinary", { apiKey: "org-b-key" }));

    expect(await resolveTenantCredential("org-resolver-a", "cloudinary", "apiKey")).toBe("org-a-key");
    expect(await resolveTenantCredential("org-resolver-b", "cloudinary", "apiKey")).toBe("org-b-key");
  });

  it("never returns another organization's value for a provider only one org has configured", async () => {
    await runWithTenantContext({ organizationId: "org-resolver-c" }, () =>
      integrationService.setTenantCredentials("microsoft_outlook_calendar", { apiKey: "only-org-c-has-this" }),
    );

    expect(await resolveTenantCredential("org-resolver-c", "microsoft_outlook_calendar", "apiKey")).toBe("only-org-c-has-this");
    expect(await resolveTenantCredential("org-resolver-d", "microsoft_outlook_calendar", "apiKey")).toBeUndefined();
  });

  it("returns undefined (not a throw) for a provider with no tenant credential configured, letting the caller fall back to env", async () => {
    expect(await resolveTenantCredential("org-resolver-e", "microsoft_teams_meetings", "apiKey")).toBeUndefined();
  });

  it("returns undefined for a key that was never configured on an otherwise-configured connection", async () => {
    await runWithTenantContext({ organizationId: "org-resolver-f" }, () => integrationService.setTenantCredentials("cashfree", { apiKey: "configured-key" }));
    expect(await resolveTenantCredential("org-resolver-f", "cashfree", "webhookSecret")).toBeUndefined();
  });

  it("is driven only by its organizationId argument, ignoring an unrelated ambient tenant context", async () => {
    await runWithTenantContext({ organizationId: "org-resolver-g" }, () => integrationService.setTenantCredentials("phonepe", { apiKey: "org-g-value" }));

    // Ambient context claims org-resolver-h, but the explicit argument
    // still asks for org-resolver-g's own credential — the argument
    // must win, never the ambient context.
    const result = await runWithTenantContext({ organizationId: "org-resolver-h" }, () => resolveTenantCredential("org-resolver-g", "phonepe", "apiKey"));
    expect(result).toBe("org-g-value");

    const crossResult = await runWithTenantContext({ organizationId: "org-resolver-h" }, () => resolveTenantCredential("org-resolver-h", "phonepe", "apiKey"));
    expect(crossResult).toBeUndefined();
  });

  it("resolveTenantCredentials returns only the keys that exist, omitting missing ones rather than padding with undefined", async () => {
    await runWithTenantContext({ organizationId: "org-resolver-i" }, () =>
      integrationService.setTenantCredentials("paypal", { apiKey: "i-key", accountId: "i-account" }),
    );

    const resolved = await resolveTenantCredentials("org-resolver-i", "paypal", ["apiKey", "accountId", "webhookSecret"]);
    expect(resolved).toEqual({ apiKey: "i-key", accountId: "i-account" });
    expect("webhookSecret" in resolved).toBe(false);
  });
});
