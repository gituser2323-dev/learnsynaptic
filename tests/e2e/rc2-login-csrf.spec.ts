import { test, expect } from "@playwright/test";

/**
 * RC-2 Enterprise Security Hardening — pentest: CSRF / "login CSRF".
 *
 * /api/auth/login now checks isSameOriginRequest() (see that route's
 * own doc comment for why login specifically needed this: it's the one
 * write endpoint that runs BEFORE any session cookie exists, so
 * sameSite=lax — the mitigation every other authenticated mutation in
 * this app relies on — provides zero protection here). Playwright's
 * `request` fixture is a raw HTTP client (no browser same-origin
 * policy of its own), the correct tool for proving this is a REAL
 * server-side check and not just something a browser's own CORS
 * behavior happens to already prevent — a non-browser attacker (or a
 * forged cross-site form post, which also doesn't send a matching
 * Origin) is exactly what this test simulates.
 */
test.describe("RC-2 — /api/auth/login same-origin (login CSRF) protection", () => {
  test("rejects a request with no Origin header at all", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: { email: "someone@example.com", password: "whatever-password" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.errors[0].message).toBe("Invalid request origin.");
  });

  test("pentest — Login CSRF: rejects a forged cross-site request (mismatched Origin header)", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: { email: "someone@example.com", password: "whatever-password" },
      headers: { Origin: "https://evil-attacker-site.example" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.errors[0].message).toBe("Invalid request origin.");
  });

  test("passes the origin check for a genuinely same-origin request (falls through to normal credential validation instead)", async ({ request, baseURL }) => {
    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: { email: "someone@example.com", password: "whatever-password" },
      headers: { Origin: baseURL! },
    });
    // Still 401 (this account doesn't exist) — but a DIFFERENT message,
    // proving the origin check itself passed and the request reached
    // real credential validation, not the origin gate.
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.errors[0].message).not.toBe("Invalid request origin.");
  });
});
