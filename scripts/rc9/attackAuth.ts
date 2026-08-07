import { SignJWT } from "jose";
import { Client, check, summary, BASE_URL } from "./pentestClient";

/**
 * RC-9 §4 — Authentication Attack Testing (real, over HTTP, against
 * the running dev server backed by real seeded RC-9 data).
 */

const ADMIN_EMAIL = "rc9-org-a-admin@learnsynaptic.internal";
const ADMIN_PASSWORD = "RC9-Load-Test-Pass-1";
const REAL_SECRET = process.env.JWT_ACCESS_TOKEN_SECRET || "";

async function main(): Promise<void> {
  console.log(`Target: ${BASE_URL}\n`);

  // 1. Invalid credentials
  {
    const c = new Client("invalid-creds");
    const res = await c.login(ADMIN_EMAIL, "WrongPassword123");
    check("AUTH-01", res.status === 401, `invalid password -> ${res.status} (expect 401)`);
  }

  // 2. Nonexistent account — same shape as invalid password (no enumeration)
  {
    const c = new Client("nonexistent");
    const res = await c.login("nobody-real-account@learnsynaptic.internal", "WhateverPassword123");
    check("AUTH-02", res.status === 401, `nonexistent account -> ${res.status} (expect 401, indistinguishable from wrong-password)`);
  }

  // 3. Brute force / lockout — 6 rapid wrong-password attempts against one
  // dedicated account (never touched by any other check in this script,
  // so no shared-IP rate-limit state from earlier checks can mask the
  // result). Real behavior confirmed by direct isolated testing: a
  // locked account responds HTTP 200 with {success:true, locked:true,
  // lockedUntil} — NOT a 401/403 — this is a deliberate API design
  // (see app/api/auth/login/route.ts's own doc comment), so the check
  // below inspects the response BODY, not just the status code.
  {
    const c = new Client("bruteforce");
    let lockedOut = false;
    for (let i = 0; i < 6; i++) {
      const res = await c.login("rc9-org-c-counsellor@learnsynaptic.internal", `WrongAttempt${i}!`);
      if (res.status === 200 && res.body?.locked === true) lockedOut = true;
    }
    check("AUTH-03", lockedOut, `6 rapid wrong-password attempts against one account -> account lockout triggered (body.locked===true): ${lockedOut}`);
    // Confirm the REAL password also now fails while locked (proves the lockout is real, not cosmetic — no tokens issued)
    const realAttempt = await c.login("rc9-org-c-counsellor@learnsynaptic.internal", ADMIN_PASSWORD);
    check("AUTH-03b", realAttempt.status === 200 && realAttempt.body?.locked === true && !c.getCookie("ls_access_token"), `correct password while locked -> locked=${realAttempt.body?.locked}, no access-token cookie issued: ${!c.getCookie("ls_access_token")}`);
  }

  // 4. Password spraying — one common password across many different
  // (nonexistent) accounts, from one client/IP. Uses its own dedicated
  // IP (via X-Forwarded-For) so it doesn't consume the shared IP-based
  // login rate-limit bucket other checks in this script also use.
  {
    const c = new Client("spray");
    let anyRateLimited = false;
    for (let i = 0; i < 12; i++) {
      const res = await c.req("POST", "/api/auth/login", { body: { email: `spray-target-${i}@learnsynaptic.internal`, password: "Password123!" }, headers: { "x-forwarded-for": "198.51.100.10" } });
      if (res.status === 429) anyRateLimited = true;
    }
    check("AUTH-04", anyRateLimited, `12 login attempts across different emails, same IP -> rate limited (expect true; limiter keys per-route+IP, not per-account)`);
  }

  // 4b. The same spray, but spoofing a DIFFERENT X-Forwarded-For value
  // on every request — a real, live-proven gap found this pass (see
  // lib/api/targetRateLimit.ts's own doc comment): getClientIp() trusts
  // X-Forwarded-For with no trusted-proxy validation, so this bypasses
  // the IP-keyed limiter entirely for routes with no secondary defense.
  // Login itself is NOT exploitable via this gap in practice (the
  // account-level lockout in AUTH-03 above is IP-independent), but the
  // per-IP limiter itself demonstrably does not stop this pattern.
  {
    const c = new Client("spray-spoofed");
    let blockedDespiteSpoofing = false;
    for (let i = 0; i < 12; i++) {
      const res = await c.req("POST", "/api/auth/login", { body: { email: `spray-spoofed-${i}@learnsynaptic.internal`, password: "Password123!" }, headers: { "x-forwarded-for": `203.0.113.${i}` } });
      if (res.status === 429) blockedDespiteSpoofing = true;
    }
    check("AUTH-04b [INFORMATIONAL]", true, `12 login attempts, EACH with a different spoofed X-Forwarded-For -> IP rate limit bypassed: ${!blockedDespiteSpoofing} (documented finding, not a login-specific vulnerability — see RC_9_AUDIT.md; account lockout in AUTH-03 is the real, unspoofable mitigation for login specifically; forgot-password/register/mfa-otp were fixed this pass with a second email-keyed limit dimension)`);
  }

  // 5. Forgot-password — enumeration resistance (real vs. fake email should look the same)
  {
    const c1 = new Client("forgot-real");
    const c2 = new Client("forgot-fake");
    const r1 = await c1.req("POST", "/api/auth/forgot-password", { body: { email: ADMIN_EMAIL } });
    const r2 = await c2.req("POST", "/api/auth/forgot-password", { body: { email: "definitely-not-a-real-account@learnsynaptic.internal" } });
    check("AUTH-05", r1.status === r2.status, `forgot-password real vs. fake email -> ${r1.status} vs ${r2.status} (expect identical status, no enumeration)`);
  }

  // 6. Reset-password — modified/garbage token rejected
  {
    const c = new Client("reset-garbage");
    const res = await c.req("POST", "/api/auth/reset-password", { body: { token: "garbage-not-a-real-token-00000000", password: "NewPassword123!" } });
    check("AUTH-06", res.status === 400 || res.status === 401, `garbage reset token -> ${res.status} (expect 400/401, never 200)`);
  }

  // 7. Reset-password — token from a DIFFERENT flow (verification token used as a reset token)
  {
    const c = new Client("reset-cross-flow");
    // A syntactically-plausible but never-issued token for THIS flow specifically.
    const res = await c.req("POST", "/api/auth/reset-password", { body: { token: "a".repeat(43), password: "NewPassword123!" } });
    check("AUTH-07", res.status !== 200, `unissued-but-plausible-shape reset token -> ${res.status} (expect rejected, never 200)`);
  }

  // 8. Verify-email — garbage/replayed token rejected
  {
    const c = new Client("verify-garbage");
    const res = await c.req("POST", "/api/auth/verify-email", { body: { token: "garbage-verification-token-000000" } });
    check("AUTH-08", res.status !== 200, `garbage verification token -> ${res.status} (expect rejected)`);
  }

  // 9. MFA email-OTP request — rate limited
  {
    const c = new Client("otp-request-flood");
    let rateLimited = false;
    for (let i = 0; i < 7; i++) {
      const res = await c.req("POST", "/api/auth/mfa/request-email-otp", { body: { email: ADMIN_EMAIL } });
      if (res.status === 429) rateLimited = true;
    }
    check("AUTH-09", rateLimited, `7 rapid MFA email-OTP requests -> rate limited (expect true)`);
  }

  // 10. Refresh — garbage/no refresh token rejected
  {
    const c = new Client("refresh-none");
    const res = await c.req("POST", "/api/auth/refresh", {});
    check("AUTH-10", res.status === 401, `refresh with no refresh-token cookie -> ${res.status} (expect 401)`);
  }
  {
    const c = new Client("refresh-garbage");
    c.setCookie("ls_refresh_token", "garbage-not-a-real-refresh-token");
    const res = await c.req("POST", "/api/auth/refresh", {});
    check("AUTH-11", res.status === 401, `refresh with garbage token -> ${res.status} (expect 401)`);
  }

  // 12. Forged JWT — signed with the WRONG secret
  {
    const wrongKey = new TextEncoder().encode("attacker-controlled-wrong-secret-value-not-real");
    const forged = await new SignJWT({ email: ADMIN_EMAIL, role: "admin", organizationId: "000000000000000000000000" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("000000000000000000000000")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(wrongKey);
    const c = new Client("forged-jwt-wrong-secret");
    c.setCookie("ls_access_token", forged);
    const res = await c.req("GET", "/api/auth/me");
    check("AUTH-12", res.status === 401, `JWT forged with WRONG secret -> ${res.status} (expect 401)`);
  }

  // 13. Modified claims — take a real, validly-issued token and tamper the payload segment
  if (REAL_SECRET) {
    const realKey = new TextEncoder().encode(REAL_SECRET);
    const real = await new SignJWT({ email: ADMIN_EMAIL, role: "counsellor", organizationId: "000000000000000000000000" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("000000000000000000000000")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(realKey);
    const [header, payload, sig] = real.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), role: "admin" })).toString("base64url");
    const tampered = `${header}.${tamperedPayload}.${sig}`;
    const c = new Client("tampered-claims");
    c.setCookie("ls_access_token", tampered);
    const res = await c.req("GET", "/api/auth/me");
    check("AUTH-13", res.status === 401, `JWT with tampered payload (role escalated, same signature) -> ${res.status} (expect 401 — signature must fail)`);
  } else {
    check("AUTH-13", false, "SKIPPED — JWT_ACCESS_TOKEN_SECRET not available to this script");
  }

  // 14. Expired JWT — validly signed but already-expired
  if (REAL_SECRET) {
    const realKey = new TextEncoder().encode(REAL_SECRET);
    const expired = await new SignJWT({ email: ADMIN_EMAIL, role: "admin", organizationId: "000000000000000000000000" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("000000000000000000000000")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(realKey);
    const c = new Client("expired-jwt");
    c.setCookie("ls_access_token", expired);
    const res = await c.req("GET", "/api/auth/me");
    check("AUTH-14", res.status === 401, `validly-signed but EXPIRED JWT -> ${res.status} (expect 401)`);
  } else {
    check("AUTH-14", false, "SKIPPED — no secret");
  }

  // 15. alg:none / algorithm-confusion attempt — unsigned token with alg:none header
  {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "000000000000000000000000", email: ADMIN_EMAIL, role: "admin", organizationId: "000000000000000000000000", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    const unsigned = `${header}.${payload}.`;
    const c = new Client("alg-none");
    c.setCookie("ls_access_token", unsigned);
    const res = await c.req("GET", "/api/auth/me");
    check("AUTH-15", res.status === 401, `alg:none unsigned token -> ${res.status} (expect 401 — jose's algorithms allowlist should reject this)`);
  }

  // 16. Session management — real login, list sessions, revoke, confirm
  // revoked session rejected. Dedicated spoofed IP so this doesn't
  // inherit rate-limit state consumed by earlier checks in this script.
  {
    const c = new Client("session-lifecycle", "198.51.100.50");
    const loginRes = await c.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    check("AUTH-16a", loginRes.status === 200, `real login -> ${loginRes.status} (expect 200)`);
    const meRes = await c.req("GET", "/api/auth/me");
    check("AUTH-16b", meRes.status === 200, `/api/auth/me with real session -> ${meRes.status} (expect 200)`);
    const sessionsRes = await c.req("GET", "/api/auth/sessions");
    check("AUTH-16c", sessionsRes.status === 200 && Array.isArray(sessionsRes.body?.sessions), `list sessions -> ${sessionsRes.status}, count=${sessionsRes.body?.sessions?.length}`);
    const logoutRes = await c.req("POST", "/api/auth/logout");
    check("AUTH-16d", logoutRes.status === 200, `logout -> ${logoutRes.status}`);
    const afterLogout = await c.req("GET", "/api/auth/me");
    check("AUTH-16e", afterLogout.status === 401, `/api/auth/me after logout (same cookies replayed) -> ${afterLogout.status} (expect 401 — access token itself is stateless, but refresh must be dead)`);
  }

  // 17. Refresh-token replay — login, refresh once (rotates), then replay
  // the OLD refresh token. Own dedicated spoofed IP, same reason as #16.
  {
    const c = new Client("refresh-replay", "198.51.100.51");
    await c.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const oldRefresh = c.getCookie("ls_refresh_token");
    const refreshRes = await c.req("POST", "/api/auth/refresh");
    check("AUTH-17a", refreshRes.status === 200, `first refresh -> ${refreshRes.status}`);
    const newRefresh = c.getCookie("ls_refresh_token");
    check("AUTH-17b", !!oldRefresh && !!newRefresh && oldRefresh !== newRefresh, `refresh token rotates on use -> old!=new: ${oldRefresh !== newRefresh}`);
    if (oldRefresh) {
      const replay = new Client("refresh-replay-attempt");
      replay.setCookie("ls_refresh_token", oldRefresh);
      const replayRes = await replay.req("POST", "/api/auth/refresh");
      check("AUTH-17c", replayRes.status === 401, `replaying the OLD (already-rotated) refresh token -> ${replayRes.status} (expect 401)`);
    }
  }

  // 18. Open redirect — OAuth authorize with a crafted external redirect target
  {
    const c = new Client("open-redirect");
    const res = await c.req("GET", "/api/auth/oauth/google/authorize?redirect=https://evil.example.com", { noCookies: false });
    const location = res.headers.get("location");
    const redirectsExternally = !!location && /^https?:\/\/(?!localhost|127\.0\.0\.1)/.test(location) && !location.includes(BASE_URL.replace(/^https?:\/\//, ""));
    check("AUTH-18", res.status !== 302 || !redirectsExternally, `OAuth authorize with attacker redirect param -> status=${res.status} location=${location ?? "(none)"} (expect no open redirect to evil.example.com)`);
  }

  summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
