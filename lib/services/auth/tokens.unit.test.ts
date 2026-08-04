import { describe, it, expect, vi, afterEach } from "vitest";
import { SignJWT } from "jose";
import { signAccessToken, verifyAccessToken } from "./tokens";
import { JWT_ACCESS_TOKEN_SECRET } from "@/config/auth";

/**
 * RC-2 Enterprise Security Hardening — JWT Tampering / algorithm
 * confusion pentest coverage. `tokens.ts` had zero dedicated test
 * coverage before this pass despite being the single place every
 * authenticated request's identity is established (middleware.ts's own
 * doc comment: "The sole place authentication happens"). These tests
 * construct real adversarial tokens with `jose`'s own `SignJWT` (the
 * same library the app itself uses to sign) rather than mocking
 * anything — a genuine forged/tampered/wrong-algorithm token is built
 * and handed to the real `verifyAccessToken()`.
 */

const wrongSecretKey = new TextEncoder().encode("attacker-guessed-secret-key-32-chars-long");
/** The REAL secret this app process actually resolved (config/auth.ts's
 *  own JWT_ACCESS_TOKEN_SECRET — imported directly, never reconstructed
 *  via a guessed fallback, since an unset env var resolves to a random
 *  per-process value only that module's own module-level constant
 *  actually knows) — used by the algorithm-confusion/missing-claim
 *  tests below so those specifically isolate "wrong algorithm"/
 *  "missing claim" as the rejection reason, not merely "wrong secret"
 *  (which `wrongSecretKey` above already covers as its own, separate
 *  scenario). */
const realAppSecretKey = new TextEncoder().encode(JWT_ACCESS_TOKEN_SECRET);

describe("signAccessToken / verifyAccessToken — round trip", () => {
  it("a freshly signed token verifies and returns the exact claims signed", async () => {
    const { token } = await signAccessToken({ sub: "user-1", email: "a@b.com", role: "admin", organizationId: "org-1", sessionId: "sess-1" });
    const claims = await verifyAccessToken(token);
    expect(claims).toEqual({ sub: "user-1", email: "a@b.com", role: "admin", organizationId: "org-1", sessionId: "sess-1" });
  });

  it("tolerates a missing organizationId/sessionId (a pre-RC-1 token shape) without rejecting the whole token", async () => {
    const { token } = await signAccessToken({ sub: "user-1", email: "a@b.com", role: "counsellor" });
    const claims = await verifyAccessToken(token);
    expect(claims).toEqual({ sub: "user-1", email: "a@b.com", role: "counsellor", organizationId: undefined, sessionId: undefined });
  });
});

describe("verifyAccessToken — pentest: JWT tampering / forgery", () => {
  afterEach(() => vi.useRealTimers());

  it("rejects a token signed with a completely different (attacker-guessed) secret", async () => {
    const forged = await new SignJWT({ email: "attacker@evil.com", role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("attacker")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(wrongSecretKey);
    expect(await verifyAccessToken(forged)).toBeNull();
  });

  it("rejects algorithm confusion: a token using 'none' (no signature at all)", async () => {
    // jose refuses to sign with "none" directly (by design), so this
    // constructs the classic alg:none forgery by hand — header+payload,
    // base64url-encoded, with an EMPTY signature segment — the actual
    // shape a real alg:none attack produces.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "attacker", email: "attacker@evil.com", role: "admin" })).toString("base64url");
    const forged = `${header}.${payload}.`;
    expect(await verifyAccessToken(forged)).toBeNull();
  });

  it("rejects algorithm confusion: a token signed with the app's OWN real secret but a different algorithm (HS384 instead of HS256) — proves the algorithms:[HS256] pin is load-bearing, not merely a same-secret check", async () => {
    const forged = await new SignJWT({ email: "a@b.com", role: "admin" })
      .setProtectedHeader({ alg: "HS384" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(realAppSecretKey);
    expect(await verifyAccessToken(forged)).toBeNull();
  });

  it("rejects a token whose payload was tampered with post-signing (role escalated counsellor → admin)", async () => {
    const { token } = await signAccessToken({ sub: "user-1", email: "a@b.com", role: "counsellor" });
    const [header, payload, signature] = token.split(".");
    const decodedPayload = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
    decodedPayload.role = "admin";
    const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString("base64url");
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    expect(await verifyAccessToken(tampered)).toBeNull();
  });

  it("rejects a token whose subject (sub) was tampered with post-signing (impersonating a different user id)", async () => {
    const { token } = await signAccessToken({ sub: "victim-user-id", email: "victim@b.com", role: "counsellor" });
    const [header, payload, signature] = token.split(".");
    const decodedPayload = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
    decodedPayload.sub = "attacker-controlled-id";
    const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString("base64url");
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    expect(await verifyAccessToken(tampered)).toBeNull();
  });

  it("rejects an expired token, even with a genuinely valid signature", async () => {
    vi.useFakeTimers();
    const now = new Date();
    vi.setSystemTime(now);
    const { token } = await signAccessToken({ sub: "user-1", email: "a@b.com", role: "counsellor" });
    vi.setSystemTime(new Date(now.getTime() + 20 * 60 * 1000)); // past the 15-minute TTL
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it("rejects malformed/garbage input without throwing", async () => {
    await expect(verifyAccessToken("not-a-real-jwt-at-all")).resolves.toBeNull();
    await expect(verifyAccessToken("")).resolves.toBeNull();
    await expect(verifyAccessToken("a.b.c")).resolves.toBeNull();
  });

  it("rejects a validly-signed token missing a required claim (role stripped out) — signed with the app's own real secret, isolating the missing-claim check itself", async () => {
    const forged = await new SignJWT({ email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(realAppSecretKey);
    expect(await verifyAccessToken(forged)).toBeNull();
  });

  it("rejects a token with an invalid role value (not one of counsellor/manager/admin) — signed with the app's own real secret", async () => {
    const forged = await new SignJWT({ email: "a@b.com", role: "super-admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(realAppSecretKey);
    expect(await verifyAccessToken(forged)).toBeNull();
  });
});
