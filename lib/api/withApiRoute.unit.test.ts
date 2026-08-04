import { describe, it, expect } from "vitest";
import { withApiRoute } from "./withApiRoute";
import { apiSuccess } from "./response";

/**
 * RC-2 Enterprise Security Hardening — `withApiRoute` is the one
 * cross-cutting wrapper every ~150 routes in this app go through
 * (rate limiting, RBAC, the new request-size ceiling), yet had zero
 * dedicated test coverage before this pass. Exercises the wrapper
 * directly against real `Request` objects, not a mocked handler chain.
 */

function trivialHandler() {
  return async () => apiSuccess({ ok: true });
}

describe("withApiRoute — request size ceiling (413)", () => {
  it("pentest — DoS via oversized body: rejects a request whose Content-Length exceeds the global ceiling, before the handler ever runs", async () => {
    let handlerCalled = false;
    const handler = withApiRoute("test.oversized", async () => {
      handlerCalled = true;
      return apiSuccess({ ok: true });
    });

    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-length": String(61 * 1024 * 1024) }, // over the 60MB ceiling
    });
    const response = await handler(request);

    expect(response.status).toBe(413);
    expect(handlerCalled).toBe(false);
  });

  it("allows a request within the size ceiling through to the handler", async () => {
    const handler = withApiRoute("test.normal-size", trivialHandler());
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-length": "1024" },
    });
    const response = await handler(request);
    expect(response.status).toBe(200);
  });

  it("allows a request with no Content-Length header through (can't reject on a signal that isn't present)", async () => {
    const handler = withApiRoute("test.no-content-length", trivialHandler());
    const request = new Request("http://localhost/api/test", { method: "GET" });
    const response = await handler(request);
    expect(response.status).toBe(200);
  });
});

describe("withApiRoute — rate limiting integration", () => {
  it("pentest — Rate-Limit Bypass: enforces the configured per-route limit end-to-end", async () => {
    const handler = withApiRoute("test.rate-limited-route", trivialHandler(), { rateLimit: { limit: 2, windowMs: 60_000 } });
    const makeRequest = () => new Request("http://localhost/api/test-rl", { headers: { "x-forwarded-for": "203.0.113.55" } });

    const first = await handler(makeRequest());
    const second = await handler(makeRequest());
    const third = await handler(makeRequest());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers.get("Retry-After")).toBeTruthy();
  });

  it("pentest — Rate-Limit Bypass: a different client IP gets its own independent budget", async () => {
    const handler = withApiRoute("test.rate-limited-route-2", trivialHandler(), { rateLimit: { limit: 1, windowMs: 60_000 } });
    const requestA = () => new Request("http://localhost/api/test-rl2", { headers: { "x-forwarded-for": "203.0.113.10" } });
    const requestB = () => new Request("http://localhost/api/test-rl2", { headers: { "x-forwarded-for": "203.0.113.20" } });

    await handler(requestA());
    const aBlocked = await handler(requestA());
    const bAllowed = await handler(requestB());

    expect(aBlocked.status).toBe(429);
    expect(bAllowed.status).toBe(200);
  });
});
