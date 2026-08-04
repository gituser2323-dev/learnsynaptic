import { describe, it, expect, afterEach, vi } from "vitest";
import { createServer, type Server, type IncomingMessage } from "http";
import type { ErrorTrackingProvider } from "../types";

/**
 * RC-3 — exercises the real HTTP POST against a genuine local server
 * (not a mocked fetch), the same "prove the actual wire format
 * round-trips" philosophy clamav.provider.unit.test.ts already
 * established for this codebase's other hand-rolled protocol adapter.
 */

let activeServer: Server | null = null;

afterEach(() => {
  activeServer?.close();
  activeServer = null;
});

function startCapturingServer(status = 200): { port: Promise<number>; received: Promise<{ headers: IncomingMessage["headers"]; body: unknown }> } {
  let resolveReceived!: (value: { headers: IncomingMessage["headers"]; body: unknown }) => void;
  const received = new Promise<{ headers: IncomingMessage["headers"]; body: unknown }>((resolve) => {
    resolveReceived = resolve;
  });

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      resolveReceived({ headers: req.headers, body });
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });

  activeServer = server;
  const port = new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });

  return { port, received };
}

/** config/errorTracking.ts reads process.env at MODULE EVALUATION time —
 *  `vi.resetModules()` forces a fresh instance re-reading the env vars
 *  just set below, matching clamav.provider.unit.test.ts's own pattern. */
async function loadProviderWithUrl(url: string): Promise<ErrorTrackingProvider> {
  process.env.ERROR_TRACKING_WEBHOOK_URL = url;
  process.env.ERROR_TRACKING_SERVICE_NAME = "learnsynaptic-test";
  vi.resetModules();
  const mod = await import("./webhook.provider");
  return mod.webhookErrorTrackingProvider;
}

describe("webhookErrorTrackingProvider — real HTTP POST", () => {
  it("POSTs a structured JSON event carrying the safe context fields, never the payload's raw values", async () => {
    const { port, received } = startCapturingServer(200);
    const provider = await loadProviderWithUrl(`http://127.0.0.1:${await port}/collect`);

    await provider.captureException(new Error("something broke"), {
      jobId: "job-123",
      jobType: "whatsapp.send_message",
      organizationId: "org-a",
      operation: "scheduler.job_failed_final",
    });

    const { headers, body } = (await received) as { headers: IncomingMessage["headers"]; body: Record<string, unknown> };
    expect(headers["content-type"]).toBe("application/json");
    expect(body.message).toBe("something broke");
    expect(body.jobId).toBe("job-123");
    expect(body.jobType).toBe("whatsapp.send_message");
    expect(body.organizationId).toBe("org-a");
    expect(body.operation).toBe("scheduler.job_failed_final");
    expect(body.service).toBe("learnsynaptic-test");
    expect(typeof body.timestamp).toBe("string");
  });

  it("never throws when ERROR_TRACKING_WEBHOOK_URL is blank — falls back to local logging only", async () => {
    const provider = await loadProviderWithUrl("");
    await expect(provider.captureException(new Error("boom"), {})).resolves.toBeUndefined();
  });

  it("never throws when the collector is unreachable (connection refused)", async () => {
    const provider = await loadProviderWithUrl("http://127.0.0.1:1/collect"); // port 1 — nothing listens there.
    await expect(provider.captureException(new Error("boom"), {})).resolves.toBeUndefined();
  });

  it("never throws when the collector responds with a non-2xx status", async () => {
    const { port } = startCapturingServer(500);
    const provider = await loadProviderWithUrl(`http://127.0.0.1:${await port}/collect`);
    await expect(provider.captureException(new Error("boom"), {})).resolves.toBeUndefined();
  });
});
