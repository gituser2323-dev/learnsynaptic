import { describe, it, expect } from "vitest";
import { integrationService } from "./integrationService";
import { auditLogService } from "@/lib/services/auditLog";

/**
 * Business OS Phase 8, Module 8.2 — integrationService.setTenantCredentials()/
 * clearTenantCredentials(). Distinct provider ids from
 * integrationService.unit.test.ts and credentialResolver.unit.test.ts
 * to avoid interfering with their state in the shared in-memory store.
 */
describe("integrationService.setTenantCredentials", () => {
  it("rejects an empty or all-blank credential map", async () => {
    const empty = await integrationService.setTenantCredentials("discord", {});
    expect(empty.success).toBe(false);
    if (!empty.success) expect(empty.error.code).toBe("validation");

    const blank = await integrationService.setTenantCredentials("discord", { apiKey: "   " });
    expect(blank.success).toBe(false);
  });

  it("returns not_found for an unknown provider id", async () => {
    const result = await integrationService.setTenantCredentials("carrier_pigeon", { apiKey: "x" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("not_found");
  });

  it("configures tenant credentials for a non-builtIn provider, masking values in the returned summary", async () => {
    const result = await integrationService.setTenantCredentials("discord", { webhookSecret: "wh-real-secret-value" }, { actorId: "admin-1" });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe("connected");
    expect(result.data.enabled).toBe(true);
    expect(result.data.credentialRef.type).toBe("tenant_secret");
    if (result.data.credentialRef.type === "tenant_secret") {
      expect(result.data.credentialRef.encryptedValues.webhookSecret).toBe("••••••••");
      expect(result.data.credentialRef.encryptedValues.webhookSecret).not.toContain("wh-real-secret-value");
    }
  });

  it("updating an already-configured provider's credentials replaces the stored value", async () => {
    await integrationService.setTenantCredentials("microsoft_teams", { webhookSecret: "first-value" });
    const updated = await integrationService.setTenantCredentials("microsoft_teams", { webhookSecret: "second-value" });
    expect(updated.success).toBe(true);

    const fetched = await integrationService.getIntegration("microsoft_teams");
    expect(fetched?.credentialRef.type).toBe("tenant_secret");
  });

  it("configures tenant credentials for a builtIn provider without going through connect()'s built_in rejection", async () => {
    const result = await integrationService.setTenantCredentials("email", { apiKey: "org-email-key" }, { actorId: "admin-1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.credentialRef.type).toBe("tenant_secret");

    const fetched = await integrationService.getIntegration("email");
    expect(fetched?.credentialRef.type).toBe("tenant_secret");
  });

  it("records an IntegrationLog entry and an audit log entry with only key names, never the value", async () => {
    await integrationService.setTenantCredentials("stripe", { apiKey: "sk-should-never-appear-in-logs" }, { actorId: "admin-2" });

    const logs = await integrationService.listLogs("stripe", 1, 20);
    const latest = logs.items[0];
    expect(latest.detail).toContain("apiKey");
    expect(latest.detail).not.toContain("sk-should-never-appear-in-logs");

    const auditEntries = await auditLogService.listForEntity("Integration", "stripe");
    const configuredEntry = auditEntries.find((e) => e.action === "integration.credentials_configured");
    expect(configuredEntry).toBeDefined();
    expect(JSON.stringify(configuredEntry?.metadata ?? {})).not.toContain("sk-should-never-appear-in-logs");
    expect((configuredEntry?.metadata as { keys?: string[] } | undefined)?.keys).toEqual(["apiKey"]);
  });
});

describe("integrationService.clearTenantCredentials", () => {
  it("returns not_connected when no tenant credential exists for the provider", async () => {
    const result = await integrationService.clearTenantCredentials("zoom");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("not_connected");
  });

  it("clears a configured non-builtIn provider's credentials, reverting to the 'none' default", async () => {
    await integrationService.setTenantCredentials("google_meet", { apiKey: "to-be-removed" });
    const cleared = await integrationService.clearTenantCredentials("google_meet", { actorId: "admin-1" });
    expect(cleared.success).toBe(true);
    if (cleared.success) {
      expect(cleared.data.credentialRef).toEqual({ type: "none" });
      expect(cleared.data.status).toBe("disconnected");
      expect(cleared.data.enabled).toBe(false);
    }
  });

  it("clears a configured builtIn provider's credentials, falling back to reporting env-config again", async () => {
    await integrationService.setTenantCredentials("anthropic", { apiKey: "to-be-removed" });
    const cleared = await integrationService.clearTenantCredentials("anthropic");
    expect(cleared.success).toBe(true);
    if (cleared.success) expect(cleared.data.credentialRef.type).toBe("env");
  });

  it("second clear on an already-cleared provider fails with not_connected", async () => {
    await integrationService.setTenantCredentials("razorpay", { apiKey: "value" });
    await integrationService.clearTenantCredentials("razorpay");
    const second = await integrationService.clearTenantCredentials("razorpay");
    expect(second.success).toBe(false);
    if (!second.success) expect(second.error.code).toBe("not_connected");
  });
});
