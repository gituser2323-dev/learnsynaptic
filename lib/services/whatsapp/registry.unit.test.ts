import { describe, it, expect } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { integrationService } from "@/lib/services/integrations";
import { getWhatsAppProvider, resolveWhatsAppProviderForSend } from "./registry";

/**
 * Business OS Phase 8, Module 8.5 — the real fix that makes tenant
 * self-service WhatsApp sending work without a deployment-wide env
 * edit: an organization with real, resolvable tenant credentials
 * (accessToken + phoneNumberId) gets the Meta Cloud API provider for
 * its own sends, regardless of this test environment's own
 * WHATSAPP_PROVIDER (unset here, so the deployment default is
 * "console" — the exact scenario this function exists to override).
 */
describe("resolveWhatsAppProviderForSend", () => {
  it("falls back to the deployment-wide provider when no organizationId is given", async () => {
    const provider = await resolveWhatsAppProviderForSend();
    expect(provider.id).toBe(getWhatsAppProvider().id);
  });

  it("falls back to the deployment-wide provider for an organization with no tenant WhatsApp credentials configured", async () => {
    const provider = await resolveWhatsAppProviderForSend("org-no-wa-creds");
    expect(provider.id).toBe(getWhatsAppProvider().id);
  });

  it("resolves to meta-cloud-api for an organization with real, resolvable tenant credentials — regardless of this deployment's own default provider", async () => {
    await runWithTenantContext({ organizationId: "org-with-wa-creds" }, () =>
      integrationService.setTenantCredentials("whatsapp", { accessToken: "EAAB-real-token", phoneNumberId: "123456789" }, {}),
    );

    const provider = await resolveWhatsAppProviderForSend("org-with-wa-creds");
    expect(provider.id).toBe("meta-cloud-api");
    // Proves this is a real override, not a coincidence of the test
    // environment's own default already being meta-cloud-api.
    expect(getWhatsAppProvider().id).not.toBe("meta-cloud-api");
  });

  it("does NOT resolve to meta-cloud-api when only a partial tenant credential is configured (e.g. accessToken with no phoneNumberId)", async () => {
    await runWithTenantContext({ organizationId: "org-partial-wa-creds" }, () =>
      integrationService.setTenantCredentials("whatsapp", { accessToken: "EAAB-real-token" }, {}),
    );

    const provider = await resolveWhatsAppProviderForSend("org-partial-wa-creds");
    expect(provider.id).toBe(getWhatsAppProvider().id);
  });

  it("reads ambient tenant context when no explicit organizationId argument is given", async () => {
    await runWithTenantContext({ organizationId: "org-ambient-wa-creds" }, () =>
      integrationService.setTenantCredentials("whatsapp", { accessToken: "EAAB-real-token", phoneNumberId: "987654321" }, {}),
    );

    const provider = await runWithTenantContext({ organizationId: "org-ambient-wa-creds" }, () => resolveWhatsAppProviderForSend());
    expect(provider.id).toBe("meta-cloud-api");
  });
});
