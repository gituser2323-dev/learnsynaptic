import { describe, it, expect, vi, afterEach } from "vitest";
import { authService } from "./authService";
import { mfaService } from "./mfaService";
import { getRefreshTokenRepository } from "@/lib/db";
import { hashRefreshToken } from "./refreshTokenCrypto";
import { REFRESH_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS_SHORT, MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_SECONDS } from "@/config/auth";

vi.mock("./authEmails", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authEmails")>();
  return {
    ...actual,
    sendPasswordResetEmail: vi.fn(actual.sendPasswordResetEmail),
    sendEmailVerificationEmail: vi.fn(actual.sendEmailVerificationEmail),
    sendPasswordChangedEmail: vi.fn(actual.sendPasswordChangedEmail),
    sendAccountLockedEmail: vi.fn(actual.sendAccountLockedEmail),
    sendNewDeviceLoginEmail: vi.fn(actual.sendNewDeviceLoginEmail),
  };
});

import { sendPasswordResetEmail, sendEmailVerificationEmail } from "./authEmails";

/**
 * RC-1 — Production Hardening: Authentication & Identity. Real
 * service-level coverage for the self-service flows this mission added
 * (password reset, change password, email verification, brute-force
 * lockout, the login-time MFA gate) — none of this had ANY test
 * coverage before this pass. Several cases below are deliberately
 * written as the mission's own named "penetration test" scenarios
 * (Replay, Password Reset Abuse, MFA Bypass, Session Hijacking), not
 * just happy-path checks.
 */

let counter = 0;
function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${counter}@rc1-test.local`;
}

const STRONG_PASSWORD = "OldPass123";
const NEW_STRONG_PASSWORD = "NewPass456";

async function createTestUser(label: string) {
  const email = uniqueEmail(label);
  const result = await authService.createUser({ email, password: STRONG_PASSWORD, role: "counsellor" });
  if (!result.success) throw new Error(`test setup failed: ${JSON.stringify(result.errors)}`);
  return { email, user: result.user };
}

function extractRawToken(mockFn: ReturnType<typeof vi.fn>): string {
  const call = mockFn.mock.calls.at(-1);
  if (!call) throw new Error("expected the email-send mock to have been called");
  return call[1] as string;
}

describe("authService — self-service password reset", () => {
  afterEach(() => vi.clearAllMocks());

  it("issues a reset email for a real active user and lets it be redeemed once", async () => {
    const { email } = await createTestUser("reset-happy");

    const requested = await authService.requestPasswordReset({ email });
    expect(requested).toEqual({ success: true });
    const rawToken = extractRawToken(sendPasswordResetEmail as ReturnType<typeof vi.fn>);

    const completed = await authService.completePasswordReset({ token: rawToken, newPassword: NEW_STRONG_PASSWORD });
    expect(completed).toEqual({ success: true });

    // Old password no longer works, new one does.
    const oldLogin = await authService.login({ email, password: STRONG_PASSWORD });
    expect(oldLogin.success).toBe(false);
    const newLogin = await authService.login({ email, password: NEW_STRONG_PASSWORD });
    expect(newLogin.success).toBe(true);
  });

  it("anti-enumeration: reports success for an email with no account, and never sends an email", async () => {
    const result = await authService.requestPasswordReset({ email: "no-such-account@rc1-test.local" });
    expect(result).toEqual({ success: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("pentest — Password Reset Abuse: rejects a completely fabricated token", async () => {
    const result = await authService.completePasswordReset({ token: "fabricated-token-value", newPassword: NEW_STRONG_PASSWORD });
    expect(result.success).toBe(false);
  });

  it("pentest — Replay: a reset token can only be redeemed once", async () => {
    const { email } = await createTestUser("reset-replay");
    await authService.requestPasswordReset({ email });
    const rawToken = extractRawToken(sendPasswordResetEmail as ReturnType<typeof vi.fn>);

    const first = await authService.completePasswordReset({ token: rawToken, newPassword: NEW_STRONG_PASSWORD });
    expect(first.success).toBe(true);

    const replay = await authService.completePasswordReset({ token: rawToken, newPassword: "AnotherPass789" });
    expect(replay.success).toBe(false);
  });

  it("supersedes an earlier outstanding token when requested again", async () => {
    const { email } = await createTestUser("reset-supersede");
    await authService.requestPasswordReset({ email });
    const firstToken = extractRawToken(sendPasswordResetEmail as ReturnType<typeof vi.fn>);

    await authService.requestPasswordReset({ email });
    const secondToken = extractRawToken(sendPasswordResetEmail as ReturnType<typeof vi.fn>);
    expect(secondToken).not.toBe(firstToken);

    const usingOldToken = await authService.completePasswordReset({ token: firstToken, newPassword: NEW_STRONG_PASSWORD });
    expect(usingOldToken.success).toBe(false);

    const usingNewToken = await authService.completePasswordReset({ token: secondToken, newPassword: NEW_STRONG_PASSWORD });
    expect(usingNewToken.success).toBe(true);
  });

  it("rejects a new password that fails the strength policy", async () => {
    const { email } = await createTestUser("reset-weak");
    await authService.requestPasswordReset({ email });
    const rawToken = extractRawToken(sendPasswordResetEmail as ReturnType<typeof vi.fn>);

    const result = await authService.completePasswordReset({ token: rawToken, newPassword: "alllowercase" });
    expect(result.success).toBe(false);
  });

  it("pentest — Session Hijacking: completing a reset revokes every existing session", async () => {
    const { email } = await createTestUser("reset-revoke");
    const login = await authService.login({ email, password: STRONG_PASSWORD });
    expect(login.success).toBe(true);
    if (!login.success) return;
    const oldRefreshToken = login.tokens.refreshToken;

    await authService.requestPasswordReset({ email });
    const rawToken = extractRawToken(sendPasswordResetEmail as ReturnType<typeof vi.fn>);
    await authService.completePasswordReset({ token: rawToken, newPassword: NEW_STRONG_PASSWORD });

    const refreshAttempt = await authService.refreshSession(oldRefreshToken);
    expect(refreshAttempt.success).toBe(false);
  });
});

describe("authService — self-service change password", () => {
  it("rejects when currentPassword is wrong", async () => {
    const { user } = await createTestUser("change-wrong-current");
    const result = await authService.changePassword(user.id, { currentPassword: "totally-wrong", newPassword: NEW_STRONG_PASSWORD }, undefined);
    expect(result.success).toBe(false);
  });

  it("changes the password and revokes every OTHER session but keeps the current one", async () => {
    const { email, user } = await createTestUser("change-happy");
    const sessionA = await authService.login({ email, password: STRONG_PASSWORD });
    const sessionB = await authService.login({ email, password: STRONG_PASSWORD });
    expect(sessionA.success && sessionB.success).toBe(true);
    if (!sessionA.success || !sessionB.success) return;

    // Discover session A's own sessionId (mirrors what a real access-token claim carries) —
    // matched by tokenHash, since listByUserId's own ordering isn't guaranteed and both
    // sessions are non-revoked at this point.
    const refreshTokenRepository = await getRefreshTokenRepository();
    const sessionARecord = await refreshTokenRepository.findByTokenHash(hashRefreshToken(sessionA.tokens.refreshToken));
    expect(sessionARecord).toBeTruthy();

    const result = await authService.changePassword(
      user.id,
      { currentPassword: STRONG_PASSWORD, newPassword: NEW_STRONG_PASSWORD },
      sessionARecord!.id,
    );
    expect(result.success).toBe(true);

    // Session A (the "current" one) survives; session B does not.
    const refreshA = await authService.refreshSession(sessionA.tokens.refreshToken);
    expect(refreshA.success).toBe(true);
    const refreshB = await authService.refreshSession(sessionB.tokens.refreshToken);
    expect(refreshB.success).toBe(false);
  });
});

describe("authService — self-service email verification", () => {
  afterEach(() => vi.clearAllMocks());

  it("sends a verification link, redeeming it marks the account verified", async () => {
    const { user } = await createTestUser("verify-happy");
    const requested = await authService.requestEmailVerification(user.id);
    expect(requested).toEqual({ status: "sent" });
    const rawToken = extractRawToken(sendEmailVerificationEmail as ReturnType<typeof vi.fn>);

    const verified = await authService.verifyEmail(rawToken);
    expect(verified).toEqual({ status: "verified" });
  });

  it("pentest — Replay: a verification token can only be redeemed once", async () => {
    const { user } = await createTestUser("verify-replay");
    await authService.requestEmailVerification(user.id);
    const rawToken = extractRawToken(sendEmailVerificationEmail as ReturnType<typeof vi.fn>);

    const first = await authService.verifyEmail(rawToken);
    expect(first).toEqual({ status: "verified" });
    const replay = await authService.verifyEmail(rawToken);
    expect(replay).toEqual({ status: "already_used" });
  });

  it("reports already_verified and sends no email for an already-verified account", async () => {
    const { user } = await createTestUser("verify-already");
    await authService.requestEmailVerification(user.id);
    const rawToken = extractRawToken(sendEmailVerificationEmail as ReturnType<typeof vi.fn>);
    await authService.verifyEmail(rawToken);

    vi.clearAllMocks();
    const secondRequest = await authService.requestEmailVerification(user.id);
    expect(secondRequest).toEqual({ status: "already_verified" });
    expect(sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid/unknown token", async () => {
    const result = await authService.verifyEmail("no-such-token");
    expect(result).toEqual({ status: "invalid" });
  });

  it("pentest — Expired Tokens: rejects a token past its TTL", async () => {
    const { user } = await createTestUser("verify-expired");
    await authService.requestEmailVerification(user.id);
    const rawToken = extractRawToken(sendEmailVerificationEmail as ReturnType<typeof vi.fn>);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000)); // > 24h TTL
    const result = await authService.verifyEmail(rawToken);
    vi.useRealTimers();
    expect(result).toEqual({ status: "expired" });
  });
});

describe("authService.login — brute-force lockout", () => {
  it(`pentest — Brute Force: locks the account after ${MAX_FAILED_LOGIN_ATTEMPTS} failed attempts, rejecting even a correct password until the lockout expires`, async () => {
    const { email } = await createTestUser("lockout");

    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      const attempt = await authService.login({ email, password: "wrong-password" });
      expect(attempt.success).toBe(false);
    }

    // Account is now locked — even the CORRECT password is rejected.
    const correctButLocked = await authService.login({ email, password: STRONG_PASSWORD });
    expect(correctButLocked.success).toBe(false);
    expect("locked" in correctButLocked && correctButLocked.locked).toBe(true);

    // After the lockout window elapses, login works again.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + (LOCKOUT_DURATION_SECONDS + 1) * 1000));
    const afterWindow = await authService.login({ email, password: STRONG_PASSWORD });
    vi.useRealTimers();
    expect(afterWindow.success).toBe(true);
  });
});

describe("authService.login — MFA gate", () => {
  it("pentest — MFA Bypass: rejects a correct password with no MFA code once MFA is enabled, and rejects a wrong code", async () => {
    const { email, user } = await createTestUser("mfa-gate");
    const { secret } = await mfaService.beginSetup(user.id, email);
    const { generateTotp } = await import("./totp");
    const confirmCode = generateTotp(secret);
    const confirmed = await mfaService.confirmSetup(user.id, confirmCode);
    expect(confirmed.success).toBe(true);

    const noCode = await authService.login({ email, password: STRONG_PASSWORD });
    expect(noCode.success).toBe(false);
    expect("mfaRequired" in noCode && noCode.mfaRequired).toBe(true);

    const wrongCode = await authService.login({ email, password: STRONG_PASSWORD, mfaCode: "000000" });
    expect(wrongCode.success).toBe(false);

    const rightCode = await authService.login({ email, password: STRONG_PASSWORD, mfaCode: generateTotp(secret) });
    expect(rightCode.success).toBe(true);
  });
});

describe("authService.login — Remember Me session TTL", () => {
  it("issues a long-lived refresh token when rememberMe is true, and a short one otherwise", async () => {
    const { email } = await createTestUser("remember-me");

    const remembered = await authService.login({ email, password: STRONG_PASSWORD, rememberMe: true });
    const notRemembered = await authService.login({ email, password: STRONG_PASSWORD, rememberMe: false });
    expect(remembered.success && notRemembered.success).toBe(true);
    if (!remembered.success || !notRemembered.success) return;

    const rememberedTtl = new Date(remembered.tokens.refreshTokenExpiresAt).getTime() - Date.now();
    const notRememberedTtl = new Date(notRemembered.tokens.refreshTokenExpiresAt).getTime() - Date.now();

    // Generous tolerance — only asserting which TTL bucket each falls
    // into, not exact issuance-latency-sensitive equality.
    expect(rememberedTtl).toBeGreaterThan(REFRESH_TOKEN_TTL_SECONDS_SHORT * 1000);
    expect(notRememberedTtl).toBeLessThanOrEqual(REFRESH_TOKEN_TTL_SECONDS_SHORT * 1000 + 5000);
    expect(rememberedTtl).toBeLessThanOrEqual(REFRESH_TOKEN_TTL_SECONDS * 1000 + 5000);
  });
});
