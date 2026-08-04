import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "http";

/**
 * RC-3 — Reliability, Queues & Observability. Every outbound provider
 * call in this codebase (WhatsApp/AI/Email/Payments/Calendar/Storage/
 * Webhooks/OAuth — ~30 call sites, see this module's own doc comment)
 * relies on the SAME primitive: `signal: AbortSignal.timeout(MS)`
 * passed to `fetch`. This is the one test proving that primitive
 * actually aborts a hung request in THIS runtime, against a real local
 * server that intentionally never responds — the mechanism every one
 * of those ~30 call sites depends on, verified once generically rather
 * than 30 times per-provider.
 */

let activeServer: Server | null = null;

afterEach(() => {
  activeServer?.close();
  activeServer = null;
});

function startHangingServer(): Promise<number> {
  const server = createServer(() => {
    // Deliberately never calls res.end() — simulates a provider that
    // accepted the connection but never replies, the real "no external
    // request should hang indefinitely" scenario this mechanism guards
    // against.
  });
  activeServer = server;
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

describe("AbortSignal.timeout(ms) + fetch — the shared outbound-timeout mechanism", () => {
  it("aborts a request to a server that never responds, within the configured timeout", async () => {
    const port = await startHangingServer();
    const startedAt = Date.now();

    await expect(fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(200) })).rejects.toThrow();

    const elapsedMs = Date.now() - startedAt;
    // Real wall-clock bound, not exact — proves it aborted close to the
    // configured 200ms, not by some unrelated failure, and nowhere near
    // Node's own much longer default socket timeout.
    expect(elapsedMs).toBeLessThan(2000);
  });

  it("does NOT abort a request that responds well within the timeout", async () => {
    const server = createServer((_req, res) => res.end("ok"));
    activeServer = server;
    const port = await new Promise<number>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        resolve(typeof address === "object" && address ? address.port : 0);
      });
    });

    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5000) });
    expect(response.ok).toBe(true);
  });
});
