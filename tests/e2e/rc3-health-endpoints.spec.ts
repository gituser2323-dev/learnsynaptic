import { test, expect } from "@playwright/test";

/**
 * RC-3 Reliability, Queues & Observability — liveness/readiness split.
 *
 * GET /api/health is pure liveness (process up, no dependency checks —
 * see that route's own doc comment on why a dependency outage must
 * never fail liveness). GET /api/health/ready is the real dependency
 * check (database + the MongoDB-backed job queue). Both are
 * deliberately public — a load balancer / uptime monitor has no admin
 * session — so this test hits them unauthenticated, the same way a
 * real probe would.
 */
test.describe("RC-3 — /api/health liveness and /api/health/ready readiness", () => {
  test("liveness always reports ok and never touches the database", async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("ok");
    expect(typeof body.uptimeSeconds).toBe("number");
    expect(["configured", "in-memory"]).toContain(body.database);
  });

  test("readiness reports dependency health with no secrets in the body", async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/health/ready`);
    // Either 200 (healthy) or 503 (a dependency is down) is an
    // acceptable, correctly-functioning outcome in this environment —
    // the point of this test is the RESPONSE SHAPE and status-code
    // correlation, not asserting the dev database is always up.
    expect([200, 503]).toContain(response.status());
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe(response.status() === 200 ? "ok" : "down");
    expect(body.checks.database).toHaveProperty("ok");
    expect(body.checks.queue).toHaveProperty("ok");

    const raw = JSON.stringify(body).toLowerCase();
    expect(raw).not.toContain("mongodb://");
    expect(raw).not.toContain("mongodb+srv://");
    expect(raw).not.toContain("password");
    expect(raw).not.toContain("secret");
  });
});
