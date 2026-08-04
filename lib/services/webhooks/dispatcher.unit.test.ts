import { describe, it, expect, vi, afterEach } from "vitest";
import { publish } from "@/lib/events";
import { runDueScheduledJobs } from "@/lib/services/scheduler";
import { webhookService } from "./webhookService";
import { integrationService } from "@/lib/services/integrations";
import { encryptSecret } from "./secretCrypto";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 * real end-to-end pipeline: publish() -> eventBus's wildcard subscriber
 * (dispatcher.ts, registered via eventBus.ts's own bootstrappers array)
 * -> a matching registered endpoint / connected notification provider
 * gets a scheduler job enqueued -> runDueScheduledJobs() processes it
 * through jobHandlers.ts's real signed delivery (mocked fetch standing
 * in for the third party). Every test uses a fresh, randomly-suffixed
 * event type so it can't collide with any other test file's own
 * publish() calls (lead.created, etc.) or with each other.
 */

function uniqueEventType(prefix: string): string {
  return `${prefix}.${Math.random().toString(36).slice(2)}`;
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOk() {
  global.fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("ok", { status: 200 })) as unknown as typeof fetch;
}

function mockFetchOkTracked() {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("ok", { status: 200 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

async function registerEndpoint(input: { name: string; url: string; subscribedEventTypes: string[] }) {
  const result = await webhookService.registerEndpoint(input);
  if (!result.success) throw new Error("Setup failed: " + JSON.stringify(result.errors));
  return result;
}

describe("dispatcher — webhook endpoints", () => {
  it("delivers a matching event to a subscribed, active endpoint and records a 'delivered' attempt", async () => {
    const eventType = uniqueEventType("test.event");
    const { endpoint } = await registerEndpoint({
      name: "E2E endpoint",
      url: "https://example.com/e2e-webhook",
      subscribedEventTypes: [eventType],
    });
    mockFetchOk();

    await publish(eventType, { foo: "bar" });
    await runDueScheduledJobs(50);

    const deliveries = await webhookService.listDeliveries({ endpointId: endpoint.id });
    expect(deliveries.items).toHaveLength(1);
    expect(deliveries.items[0].outcome).toBe("delivered");
    expect(deliveries.items[0].eventType).toBe(eventType);
    expect(deliveries.items[0].payloadSnapshot).toEqual({ foo: "bar" });

    const updated = await webhookService.getEndpoint(endpoint.id);
    expect(updated?.lastSuccessAt).toBeTruthy();
    expect(updated?.consecutiveFailures).toBe(0);
  });

  it("does not deliver to an endpoint that isn't subscribed to the published event type", async () => {
    const subscribedType = uniqueEventType("test.subscribed");
    const otherType = uniqueEventType("test.other");
    const { endpoint } = await registerEndpoint({
      name: "Not subscribed",
      url: "https://example.com/not-subscribed",
      subscribedEventTypes: [subscribedType],
    });
    mockFetchOk();

    await publish(otherType, {});
    await runDueScheduledJobs(50);

    const deliveries = await webhookService.listDeliveries({ endpointId: endpoint.id });
    expect(deliveries.items).toHaveLength(0);
  });

  it("a wildcard ['*'] subscription receives every event type", async () => {
    const eventType = uniqueEventType("test.wildcard");
    const { endpoint } = await registerEndpoint({
      name: "Wildcard endpoint",
      url: "https://example.com/wildcard",
      subscribedEventTypes: ["*"],
    });
    mockFetchOk();

    await publish(eventType, { hello: "world" });
    await runDueScheduledJobs(50);

    const deliveries = await webhookService.listDeliveries({ endpointId: endpoint.id });
    expect(deliveries.items.some((d) => d.eventType === eventType)).toBe(true);
  });

  it("never dispatches to a disabled endpoint — it's excluded before any delivery attempt row is even created", async () => {
    const eventType = uniqueEventType("test.disabled");
    const { endpoint } = await registerEndpoint({
      name: "Disabled endpoint",
      url: "https://example.com/disabled",
      subscribedEventTypes: [eventType],
    });
    await webhookService.setEndpointStatus(endpoint.id, "disabled");
    mockFetchOk();

    await publish(eventType, {});
    await runDueScheduledJobs(50);

    const deliveries = await webhookService.listDeliveries({ endpointId: endpoint.id });
    expect(deliveries.items).toHaveLength(0);
  });
});

describe("dispatcher — notification providers (Slack/Teams/Discord reuse Module 6.1's IntegrationConnection)", () => {
  it("delivers a matching event to a connected, enabled Slack integration and records a successful sync", async () => {
    const eventType = uniqueEventType("test.notify");
    await integrationService.connect("slack", {
      credentialRef: { type: "webhook_url", encryptedUrl: encryptSecret("https://hooks.slack.com/services/e2e") },
      config: { subscribedEventTypes: [eventType] },
    });
    mockFetchOk();

    await publish(eventType, { name: "Test Lead" });
    await runDueScheduledJobs(50);

    const integration = await integrationService.getIntegration("slack");
    expect(integration?.lastSuccessAt).toBeTruthy();
    expect(integration?.health).toBe("ok");
  });

  it("does not deliver to a connected but disabled notification provider", async () => {
    const eventType = uniqueEventType("test.notify.disabled");
    await integrationService.connect("microsoft_teams", {
      credentialRef: { type: "webhook_url", encryptedUrl: encryptSecret("https://outlook.office.com/webhook/e2e") },
      config: { subscribedEventTypes: [eventType] },
    });
    await integrationService.setEnabled("microsoft_teams", false);
    const fetchMock = mockFetchOkTracked();

    await publish(eventType, {});
    await runDueScheduledJobs(50);

    // Not "never called" — an earlier test's own wildcard-subscribed
    // endpoint legitimately matches every event in this shared
    // in-memory store too, so it's still due for delivery here. What
    // matters is that THIS disabled Teams connection's own webhook URL
    // specifically was never dialed.
    expect(fetchMock.mock.calls.some((call) => call[0] === "https://outlook.office.com/webhook/e2e")).toBe(false);
  });

  it("respects config.subscribedEventTypes — a Discord connection configured for one event type ignores another", async () => {
    const subscribedType = uniqueEventType("test.discord.subscribed");
    const otherType = uniqueEventType("test.discord.other");
    await integrationService.connect("discord", {
      credentialRef: { type: "webhook_url", encryptedUrl: encryptSecret("https://discord.com/api/webhooks/e2e") },
      config: { subscribedEventTypes: [subscribedType] },
    });
    const fetchMock = mockFetchOkTracked();

    await publish(otherType, {});
    await runDueScheduledJobs(50);

    // Same shared-store caveat as the disabled-provider test above.
    expect(fetchMock.mock.calls.some((call) => call[0] === "https://discord.com/api/webhooks/e2e")).toBe(false);
  });
});
