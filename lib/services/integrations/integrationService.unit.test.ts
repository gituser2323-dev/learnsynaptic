import { describe, it, expect } from "vitest";
import { integrationService } from "./integrationService";
import { INTEGRATION_PROVIDERS } from "./providerCatalog";

/**
 * Integrations Hub (Phase 6), Module 6.1.
 *
 * This test environment has no WHATSAPP_PROVIDER/EMAIL_PROVIDER/
 * AI_PROVIDER configured (all default to their own "unconfigured"
 * state), so the builtIn providers' live status is honestly
 * "disconnected"/"unknown" here — these tests lock in that the
 * registry reports that real state rather than fabricating anything,
 * the same discipline every other AI CRM module's own test suite
 * already established. Each test group uses a different real
 * catalog provider id to avoid interfering with another group's state
 * in the shared in-memory repository.
 */
describe("integrationService.listIntegrations", () => {
  it("returns exactly one summary per catalog provider", async () => {
    const integrations = await integrationService.listIntegrations();
    expect(integrations).toHaveLength(INTEGRATION_PROVIDERS.length);
  });

  it("reports builtIn providers as disconnected/unknown in this unconfigured environment", async () => {
    const integrations = await integrationService.listIntegrations();
    for (const id of ["whatsapp", "email", "openai", "anthropic", "gemini"]) {
      const summary = integrations.find((i) => i.provider.id === id);
      expect(summary?.status).toBe("disconnected");
      expect(summary?.health).toBe("unknown");
      expect(summary?.credentialRef.type).toBe("env");
    }
  });

  it("reports a never-connected non-builtIn provider as disconnected with credentialRef 'none'", async () => {
    const integrations = await integrationService.listIntegrations();
    const razorpay = integrations.find((i) => i.provider.id === "razorpay");
    expect(razorpay?.status).toBe("disconnected");
    expect(razorpay?.credentialRef).toEqual({ type: "none" });
  });
});

describe("integrationService.connect / disconnect — builtIn rejection", () => {
  it("rejects connecting a builtIn provider", async () => {
    const result = await integrationService.connect("whatsapp", {});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("built_in");
  });

  it("rejects disconnecting a builtIn provider", async () => {
    const result = await integrationService.disconnect("openai");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("built_in");
  });

  it("returns not_found for an unknown provider id", async () => {
    const result = await integrationService.connect("carrier_pigeon", {});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("not_found");
  });
});

describe("integrationService — full lifecycle for a non-builtIn provider (slack)", () => {
  it("connects, reflecting connected/enabled with the supplied config", async () => {
    const result = await integrationService.connect("slack", { config: { channel: "#leads" } }, { actorId: "admin-1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("connected");
    expect(result.data.enabled).toBe(true);
    expect(result.data.config).toEqual({ channel: "#leads" });
  });

  it("rejects a config with a credential-shaped key", async () => {
    const result = await integrationService.connect("zoom", { config: { apiSecret: "leaked" } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("validation");
  });

  it("disables then re-enables an already-connected provider", async () => {
    await integrationService.connect("microsoft_teams", {});
    const disabled = await integrationService.setEnabled("microsoft_teams", false);
    expect(disabled.success).toBe(true);
    if (disabled.success) expect(disabled.data.enabled).toBe(false);

    const reEnabled = await integrationService.setEnabled("microsoft_teams", true);
    expect(reEnabled.success).toBe(true);
    if (reEnabled.success) expect(reEnabled.data.enabled).toBe(true);
  });

  it("rejects enabling/disabling a provider that was never connected", async () => {
    const result = await integrationService.setEnabled("stripe", true);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("not_connected");
  });

  it("disconnects a connected provider, then rejects disconnecting it again", async () => {
    await integrationService.connect("google_calendar", {});
    const disconnected = await integrationService.disconnect("google_calendar");
    expect(disconnected.success).toBe(true);
    if (disconnected.success) {
      expect(disconnected.data.status).toBe("disconnected");
      expect(disconnected.data.enabled).toBe(false);
    }

    const secondDisconnect = await integrationService.disconnect("google_calendar");
    expect(secondDisconnect.success).toBe(false);
    if (!secondDisconnect.success) expect(secondDisconnect.error.code).toBe("not_connected");
  });

  it("reconnecting after a disconnect flips it back to connected (the 'Reconnect' lifecycle)", async () => {
    await integrationService.connect("google_meet", {});
    await integrationService.disconnect("google_meet");
    const reconnected = await integrationService.connect("google_meet", {});
    expect(reconnected.success).toBe(true);
    if (reconnected.success) expect(reconnected.data.status).toBe("connected");
  });

  it("updates config for a connected provider, rejecting a credential-shaped key", async () => {
    await integrationService.connect("aws_s3", { config: { bucket: "learnsynaptic-media" } });
    const updated = await integrationService.updateConfig("aws_s3", { bucket: "new-bucket-name" });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.config).toEqual({ bucket: "new-bucket-name" });

    const rejected = await integrationService.updateConfig("aws_s3", { accessKey: "leaked" });
    expect(rejected.success).toBe(false);
  });

  it("records a sync outcome — success sets health ok + lastSuccessAt; failure sets health error + lastError", async () => {
    await integrationService.connect("generic_webhook", {});
    await integrationService.recordSync("generic_webhook", "success", "Synced 3 events.");

    const afterSuccess = await integrationService.getIntegration("generic_webhook");
    expect(afterSuccess?.health).toBe("ok");
    expect(afterSuccess?.lastSuccessAt).toBeDefined();

    await integrationService.recordSync("generic_webhook", "failure", "Vendor returned 500.");
    const afterFailure = await integrationService.getIntegration("generic_webhook");
    expect(afterFailure?.health).toBe("error");
    expect(afterFailure?.lastError).toBe("Vendor returned 500.");
  });

  it("recordSync is a no-op for a builtIn provider", async () => {
    await integrationService.recordSync("whatsapp", "success", "should be ignored");
    const summary = await integrationService.getIntegration("whatsapp");
    // Still reflects live env-derived status, not a fabricated sync result.
    expect(summary?.status).toBe("disconnected");
  });

  it("listLogs returns this provider's own history, newest first", async () => {
    await integrationService.connect("slack", {});
    // Ensures a distinct createdAt ordering isn't a same-millisecond tie
    // in the in-memory repository's own timestamp-string sort.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await integrationService.disconnect("slack");
    const page = await integrationService.listLogs("slack", 1, 20);
    expect(page.total).toBeGreaterThanOrEqual(2);
    expect(page.items[0].eventType).toBe("disconnect");
  });
});
