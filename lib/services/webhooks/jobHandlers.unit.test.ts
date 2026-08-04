import { describe, it, expect, vi, afterEach } from "vitest";
import { enqueueJob, runDueScheduledJobs } from "@/lib/services/scheduler";
import { webhookService } from "./webhookService";
import { getWebhookDeliveryAttemptRepository, getWebhookEndpointRepository } from "@/lib/db";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 * "webhook.deliver" job handler's own retry/dead-letter/auto-disable
 * branching, exercised directly via enqueueJob() with a
 * test-controlled retryPolicy (rather than through the dispatcher,
 * which always uses the fixed production WEBHOOK_RETRY_POLICY) so each
 * test can pick exactly how many attempts it needs — the same
 * "isolate the mechanism, not the whole pipeline" judgment
 * schedulerService.unit.test.ts's own retry-branching tests already
 * make. dispatcher.unit.test.ts covers the publish() -> dispatch ->
 * deliver pipeline end-to-end; this file is only about what happens
 * once a "webhook.deliver" job is already queued.
 */

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function seedEndpoint(overrides: { consecutiveFailures?: number } = {}) {
  const result = await webhookService.registerEndpoint({
    name: "jobHandlers test endpoint",
    url: "https://example.com/job-handler-test",
    subscribedEventTypes: ["*"],
  });
  if (!result.success) throw new Error("Setup failed: " + JSON.stringify(result.errors));
  const { endpoint } = result;
  if (overrides.consecutiveFailures !== undefined) {
    const endpointRepository = await getWebhookEndpointRepository();
    await endpointRepository.update(endpoint.id, { consecutiveFailures: overrides.consecutiveFailures });
  }
  return endpoint;
}

async function seedPendingAttempt(endpointId: string, eventType: string) {
  const attemptRepository = await getWebhookDeliveryAttemptRepository();
  return attemptRepository.create({
    endpointId,
    eventId: `evt_${Math.random().toString(36).slice(2)}`,
    eventType,
    payloadSnapshot: { some: "payload" },
    attempt: 1,
    outcome: "pending",
  });
}

function mockFetchStatus(status: number) {
  global.fetch = vi.fn(async () => new Response(status >= 400 ? "error body" : "ok", { status })) as unknown as typeof fetch;
}

describe("webhookDeliverHandler — retryable (5xx) failures", () => {
  it("stays 'failed' (not dead_letter) while retries remain, retries on backoff, and reaches dead_letter only on the final attempt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const endpoint = await seedEndpoint();
    const attempt = await seedPendingAttempt(endpoint.id, "some.event");
    mockFetchStatus(503);

    await enqueueJob({
      jobType: "webhook.deliver",
      payload: { attemptRowId: attempt.id, endpointId: endpoint.id, eventId: attempt.eventId, eventType: "some.event", payload: {} },
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 3, backoffMinutes: [1, 5] },
    });

    // Every assertion below targets rows for THIS event specifically —
    // never a raw `processed` count — because runDueScheduledJobs()
    // also drains other real, self-perpetuating background jobs this
    // app bootstraps (the Automation Engine's own "automation.tick"
    // heartbeat, WhatsApp account health checks, etc.), so the total
    // number of jobs processed in any one call isn't a signal about
    // THIS test's own job at all.
    async function rowsForThisEvent() {
      return (await webhookService.listDeliveries({ endpointId: endpoint.id })).items.filter((d) => d.eventId === attempt.eventId);
    }

    // Attempt 1 (job.attempts starts 0) — updates the seeded row in place.
    await runDueScheduledJobs(200);
    let rows = await rowsForThisEvent();
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe("failed");
    expect(rows[0].attempt).toBe(1);

    // Not due yet (backoffMinutes[0] = 1 minute) — no new row appears.
    await runDueScheduledJobs(200);
    rows = await rowsForThisEvent();
    expect(rows).toHaveLength(1);

    // Attempt 2 — a NEW row (attempt-by-attempt granularity), still not final.
    await vi.advanceTimersByTimeAsync(60_000);
    await runDueScheduledJobs(200);
    rows = await rowsForThisEvent();
    expect(rows).toHaveLength(2);
    expect(rows.every((d) => d.outcome === "failed")).toBe(true);

    // Attempt 3 — final (maxAttempts: 3) — dead_letter, no further reschedule.
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await runDueScheduledJobs(200);
    rows = await rowsForThisEvent();
    expect(rows).toHaveLength(3);
    expect(rows.find((d) => d.attempt === 3)?.outcome).toBe("dead_letter");

    // Exhausted — a full day later, still exactly 3 rows, no 4th attempt.
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    await runDueScheduledJobs(200);
    rows = await rowsForThisEvent();
    expect(rows).toHaveLength(3);
  });
});

describe("webhookDeliverHandler — non-retryable (4xx other than 429) failures", () => {
  it("marks dead_letter immediately on attempt 1, even with retries remaining", async () => {
    const endpoint = await seedEndpoint();
    const attempt = await seedPendingAttempt(endpoint.id, "some.event");
    mockFetchStatus(400);

    await enqueueJob({
      jobType: "webhook.deliver",
      payload: { attemptRowId: attempt.id, endpointId: endpoint.id, eventId: attempt.eventId, eventType: "some.event", payload: {} },
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 5, backoffMinutes: [1, 5, 15, 60, 240] },
    });
    await runDueScheduledJobs(200);

    const rows = (await webhookService.listDeliveries({ endpointId: endpoint.id })).items.filter((d) => d.eventId === attempt.eventId);
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe("dead_letter");
  });
});

describe("webhookDeliverHandler — success", () => {
  it("marks 'delivered', resets consecutiveFailures to 0, and updates lastSuccessAt", async () => {
    const endpoint = await seedEndpoint({ consecutiveFailures: 3 });
    const attempt = await seedPendingAttempt(endpoint.id, "some.event");
    mockFetchStatus(200);

    await enqueueJob({
      jobType: "webhook.deliver",
      payload: { attemptRowId: attempt.id, endpointId: endpoint.id, eventId: attempt.eventId, eventType: "some.event", payload: {} },
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 3, backoffMinutes: [1] },
    });
    await runDueScheduledJobs(200);

    const updated = await webhookService.getEndpoint(endpoint.id);
    expect(updated?.consecutiveFailures).toBe(0);
    expect(updated?.lastSuccessAt).toBeTruthy();

    const rows = (await webhookService.listDeliveries({ endpointId: endpoint.id })).items.filter((d) => d.eventId === attempt.eventId);
    expect(rows[0].outcome).toBe("delivered");
  });
});

describe("webhookDeliverHandler — 'Disable Broken Endpoints' auto-disable threshold", () => {
  it("flips status to 'auto_disabled' once the 10th consecutive FINAL-attempt failure lands", async () => {
    const endpoint = await seedEndpoint({ consecutiveFailures: 9 });
    const attempt = await seedPendingAttempt(endpoint.id, "some.event");
    mockFetchStatus(500);

    await enqueueJob({
      jobType: "webhook.deliver",
      payload: { attemptRowId: attempt.id, endpointId: endpoint.id, eventId: attempt.eventId, eventType: "some.event", payload: {} },
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 1, backoffMinutes: [] }, // a single, immediately-final attempt
    });
    await runDueScheduledJobs(200);

    const updated = await webhookService.getEndpoint(endpoint.id);
    expect(updated?.consecutiveFailures).toBe(10);
    expect(updated?.status).toBe("auto_disabled");
  });

  it("does not auto-disable before the threshold is reached", async () => {
    const endpoint = await seedEndpoint({ consecutiveFailures: 5 });
    const attempt = await seedPendingAttempt(endpoint.id, "some.event");
    mockFetchStatus(500);

    await enqueueJob({
      jobType: "webhook.deliver",
      payload: { attemptRowId: attempt.id, endpointId: endpoint.id, eventId: attempt.eventId, eventType: "some.event", payload: {} },
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 1, backoffMinutes: [] },
    });
    await runDueScheduledJobs(200);

    const updated = await webhookService.getEndpoint(endpoint.id);
    expect(updated?.consecutiveFailures).toBe(6);
    expect(updated?.status).toBe("active");
  });

  it("a retryable failure that isn't the final attempt does not count toward consecutiveFailures yet", async () => {
    const endpoint = await seedEndpoint({ consecutiveFailures: 9 });
    const attempt = await seedPendingAttempt(endpoint.id, "some.event");
    mockFetchStatus(503);

    await enqueueJob({
      jobType: "webhook.deliver",
      payload: { attemptRowId: attempt.id, endpointId: endpoint.id, eventId: attempt.eventId, eventType: "some.event", payload: {} },
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 3, backoffMinutes: [1, 5] }, // attempt 1 of 3 — not final
    });
    await runDueScheduledJobs(200);

    const updated = await webhookService.getEndpoint(endpoint.id);
    expect(updated?.consecutiveFailures).toBe(9); // unchanged — only final attempts count
    expect(updated?.status).toBe("active");
  });
});

describe("webhookDeliverHandler — an endpoint disabled/deleted after its job was queued", () => {
  it("no-ops (completes) rather than delivering to a URL an admin turned off", async () => {
    const endpoint = await seedEndpoint();
    const attempt = await seedPendingAttempt(endpoint.id, "some.event");
    await webhookService.setEndpointStatus(endpoint.id, "disabled");
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response("ok", { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await enqueueJob({
      jobType: "webhook.deliver",
      payload: { attemptRowId: attempt.id, endpointId: endpoint.id, eventId: attempt.eventId, eventType: "some.event", payload: {} },
      runAt: new Date().toISOString(),
      retryPolicy: { maxAttempts: 3, backoffMinutes: [1] },
    });
    await runDueScheduledJobs(200);

    expect(fetchMock.mock.calls.some((call) => call[0] === endpoint.url)).toBe(false);
  });
});
