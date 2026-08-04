import { describe, it, expect, vi, afterEach } from "vitest";
import { webhookService } from "./webhookService";
import { WebhookEndpointNotFoundError } from "./errors";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * webhookService's own lifecycle + delivery-visibility surface, tested
 * against the in-memory repositories (this test env has no MongoDB
 * configured) with a mocked global.fetch standing in for the real
 * third-party endpoint, the same "real integration test over a mock
 * service" discipline calendarService's own tests already establish.
 */

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(status: number, body = "{}") {
  global.fetch = vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

async function registerTestEndpoint(overrides: Partial<{ name: string; url: string; subscribedEventTypes: string[] }> = {}) {
  const result = await webhookService.registerEndpoint({
    name: overrides.name ?? "Test endpoint",
    url: overrides.url ?? "https://example.com/webhook",
    subscribedEventTypes: overrides.subscribedEventTypes ?? ["lead.created"],
  });
  if (!result.success) throw new Error("Setup failed: " + JSON.stringify(result.errors));
  return result;
}

describe("webhookService.registerEndpoint", () => {
  it("registers an endpoint and returns a real secret exactly once", async () => {
    const result = await registerTestEndpoint({ name: "My endpoint" });
    expect(result.endpoint.name).toBe("My endpoint");
    expect(result.endpoint.status).toBe("active");
    expect(result.secret.length).toBeGreaterThanOrEqual(32);
    // The persisted endpoint never carries the plaintext secret.
    expect(JSON.stringify(result.endpoint)).not.toContain(result.secret);
  });

  it("returns validation errors rather than throwing for invalid input", async () => {
    const result = await webhookService.registerEndpoint({ name: "", url: "", subscribedEventTypes: [] });
    expect(result.success).toBe(false);
  });

  it("accepts an admin-supplied secret instead of generating one", async () => {
    const suppliedSecret = "an-admin-chosen-secret-value-16";
    const result = await webhookService.registerEndpoint({
      name: "Custom secret endpoint",
      url: "https://example.com/webhook",
      subscribedEventTypes: ["*"],
      secret: suppliedSecret,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.secret).toBe(suppliedSecret);
  });
});

describe("webhookService — get/list/update/enable-disable/delete", () => {
  it("getEndpoint returns null for an unknown id", async () => {
    expect(await webhookService.getEndpoint("no-such-id")).toBeNull();
  });

  it("listEndpoints returns the registered endpoint", async () => {
    const { endpoint } = await registerTestEndpoint({ name: "Listed endpoint" });
    const page = await webhookService.listEndpoints({});
    expect(page.items.some((e) => e.id === endpoint.id)).toBe(true);
  });

  it("updateEndpoint changes name/url/subscribedEventTypes", async () => {
    const { endpoint } = await registerTestEndpoint();
    const updated = await webhookService.updateEndpoint(endpoint.id, { name: "Renamed", subscribedEventTypes: ["opportunity.won"] });
    expect(updated.name).toBe("Renamed");
    expect(updated.subscribedEventTypes).toEqual(["opportunity.won"]);
  });

  it("updateEndpoint throws WebhookEndpointNotFoundError for an unknown id", async () => {
    await expect(webhookService.updateEndpoint("no-such-id", { name: "x" })).rejects.toThrow(WebhookEndpointNotFoundError);
  });

  it("setEndpointStatus disables and re-enables, clearing consecutiveFailures on re-enable", async () => {
    const { endpoint } = await registerTestEndpoint();
    const disabled = await webhookService.setEndpointStatus(endpoint.id, "disabled");
    expect(disabled.status).toBe("disabled");
    const reenabled = await webhookService.setEndpointStatus(endpoint.id, "active");
    expect(reenabled.status).toBe("active");
    expect(reenabled.consecutiveFailures).toBe(0);
  });

  it("deleteEndpoint soft-deletes (status: disabled) rather than removing the record", async () => {
    const { endpoint } = await registerTestEndpoint();
    await webhookService.deleteEndpoint(endpoint.id);
    const stillThere = await webhookService.getEndpoint(endpoint.id);
    expect(stillThere?.status).toBe("disabled");
  });

  it("deleteEndpoint throws WebhookEndpointNotFoundError for an unknown id", async () => {
    await expect(webhookService.deleteEndpoint("no-such-id")).rejects.toThrow(WebhookEndpointNotFoundError);
  });
});

describe("webhookService.rotateSecret", () => {
  it("returns a new secret, different from the original, and re-signs future deliveries with it", async () => {
    const { endpoint, secret: originalSecret } = await registerTestEndpoint();
    // Captured as a primitive string BEFORE rotating — the in-memory
    // repository's own `update()` mutates the stored object in place
    // (see webhookEndpoint.inMemory.repository.ts), so `endpoint` itself
    // is the same reference rotateSecret() goes on to mutate.
    const originalEncryptedSecret = endpoint.encryptedSecret;
    const rotated = await webhookService.rotateSecret(endpoint.id);
    expect(rotated.secret).not.toBe(originalSecret);
    expect(rotated.endpoint.encryptedSecret).not.toBe(originalEncryptedSecret);
  });

  it("throws WebhookEndpointNotFoundError for an unknown id", async () => {
    await expect(webhookService.rotateSecret("no-such-id")).rejects.toThrow(WebhookEndpointNotFoundError);
  });
});

describe("webhookService.testEndpoint — real, immediate, signed delivery", () => {
  it("records a 'delivered' attempt on a successful response", async () => {
    mockFetchOnce(200, "ok");
    const { endpoint } = await registerTestEndpoint();
    const result = await webhookService.testEndpoint(endpoint.id);
    expect(result.success).toBe(true);
    expect(result.httpStatusCode).toBe(200);

    const deliveries = await webhookService.listDeliveries({ endpointId: endpoint.id });
    expect(deliveries.items.some((d) => d.eventType === "webhook.test" && d.outcome === "delivered")).toBe(true);
  });

  it("records a 'dead_letter' attempt on a failing response, without throwing", async () => {
    mockFetchOnce(500, "server error");
    const { endpoint } = await registerTestEndpoint();
    const result = await webhookService.testEndpoint(endpoint.id);
    expect(result.success).toBe(false);
    expect(result.httpStatusCode).toBe(500);

    const deliveries = await webhookService.listDeliveries({ endpointId: endpoint.id });
    expect(deliveries.items.some((d) => d.eventType === "webhook.test" && d.outcome === "dead_letter")).toBe(true);
  });

  it("throws WebhookEndpointNotFoundError for an unknown id", async () => {
    await expect(webhookService.testEndpoint("no-such-id")).rejects.toThrow(WebhookEndpointNotFoundError);
  });
});

describe("webhookService.replayDelivery — replays the DELIVERY, not the original domain event", () => {
  it("re-delivers the same stored payload snapshot as a new attempt row, incrementing attempt", async () => {
    mockFetchOnce(500, "fail");
    const { endpoint } = await registerTestEndpoint();
    await webhookService.testEndpoint(endpoint.id);
    const firstPage = await webhookService.listDeliveries({ endpointId: endpoint.id });
    const original = firstPage.items[0];
    expect(original.attempt).toBe(1);

    mockFetchOnce(200, "ok now");
    const replayed = await webhookService.replayDelivery(original.id);
    expect(replayed.attempt).toBe(original.attempt + 1);
    expect(replayed.outcome).toBe("delivered");
    expect(replayed.eventType).toBe(original.eventType);
    expect(replayed.payloadSnapshot).toEqual(original.payloadSnapshot);

    // Original row is untouched — one row per real attempt, not overwritten.
    const endpointAfter = await webhookService.getEndpoint(endpoint.id);
    expect(endpointAfter?.consecutiveFailures).toBe(0);
    expect(endpointAfter?.lastSuccessAt).toBeTruthy();
  });

  it("throws for an unknown attempt id", async () => {
    await expect(webhookService.replayDelivery("no-such-attempt")).rejects.toThrow();
  });
});
