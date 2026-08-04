import { describe, it, expect, vi } from "vitest";
import { mfaService } from "./mfaService";
import { authService } from "./authService";
import { generateTotp } from "./totp";

vi.mock("./authEmails", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authEmails")>();
  return { ...actual, sendMfaEnabledEmail: vi.fn(), sendMfaDisabledEmail: vi.fn(), sendMfaEmailOtp: vi.fn(actual.sendMfaEmailOtp) };
});
import { sendMfaEmailOtp } from "./authEmails";

let counter = 0;
function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${counter}@mfa-test.local`;
}

async function createTestUser(label: string) {
  const email = uniqueEmail(label);
  const result = await authService.createUser({ email, password: "OldPass123", role: "counsellor" });
  if (!result.success) throw new Error(`test setup failed: ${JSON.stringify(result.errors)}`);
  return { email, user: result.user };
}

async function enableMfaFor(userId: string, email: string): Promise<string> {
  const { secret } = await mfaService.beginSetup(userId, email);
  const confirmed = await mfaService.confirmSetup(userId, generateTotp(secret));
  if (!confirmed.success) throw new Error("test setup: confirmSetup failed");
  return secret;
}

describe("mfaService.beginSetup / confirmSetup", () => {
  it("rejects confirmation with a wrong code and does not enable MFA", async () => {
    const { user, email } = await createTestUser("confirm-wrong");
    await mfaService.beginSetup(user.id, email);
    const result = await mfaService.confirmSetup(user.id, "000000");
    expect(result.success).toBe(false);
    expect((await mfaService.getStatus(user.id))?.mfaEnabled).toBe(false);
  });

  it("enables MFA and issues 10 recovery codes on a correct confirmation code", async () => {
    const { user, email } = await createTestUser("confirm-right");
    const { secret } = await mfaService.beginSetup(user.id, email);
    const result = await mfaService.confirmSetup(user.id, generateTotp(secret));
    expect(result.success).toBe(true);
    if (result.success) expect(result.recoveryCodes).toHaveLength(10);
    expect((await mfaService.getStatus(user.id))?.mfaEnabled).toBe(true);
  });
});

describe("mfaService.disable", () => {
  it("requires the correct current password", async () => {
    const { user, email } = await createTestUser("disable-wrong-pw");
    await enableMfaFor(user.id, email);
    const result = await mfaService.disable(user.id, "totally-wrong-password");
    expect(result.success).toBe(false);
    expect((await mfaService.getStatus(user.id))?.mfaEnabled).toBe(true);
  });

  it("disables MFA and revokes all trusted devices on success", async () => {
    const { user, email } = await createTestUser("disable-happy");
    await enableMfaFor(user.id, email);
    await mfaService.trustDevice(user.id, "Test Device");
    expect(await mfaService.listTrustedDevices(user.id)).toHaveLength(1);

    const result = await mfaService.disable(user.id, "OldPass123");
    expect(result.success).toBe(true);
    expect((await mfaService.getStatus(user.id))?.mfaEnabled).toBe(false);

    // revoke() removes the grant outright (see trustedDevice repository's
    // own doc comment) — "revoked" means gone from the active list.
    expect(await mfaService.listTrustedDevices(user.id)).toHaveLength(0);
  });
});

describe("mfaService.verifyCode — the TOTP / recovery-code / email-OTP chain", () => {
  it("accepts a valid TOTP code", async () => {
    const { user, email } = await createTestUser("verify-totp");
    const secret = await enableMfaFor(user.id, email);
    expect(await mfaService.verifyCode(user.id, generateTotp(secret))).toBe(true);
  });

  it("rejects a wrong 6-digit code", async () => {
    const { user, email } = await createTestUser("verify-totp-wrong");
    const secret = await enableMfaFor(user.id, email);
    const real = generateTotp(secret);
    const wrong = real === "000000" ? "111111" : "000000";
    expect(await mfaService.verifyCode(user.id, wrong)).toBe(false);
  });

  it("pentest — Replay: a recovery code is accepted once, then rejected on reuse", async () => {
    const { user, email } = await createTestUser("verify-recovery");
    const { secret } = await mfaService.beginSetup(user.id, email);
    const confirmed = await mfaService.confirmSetup(user.id, generateTotp(secret));
    expect(confirmed.success).toBe(true);
    if (!confirmed.success) return;
    const recoveryCode = confirmed.recoveryCodes[0]!;

    expect(await mfaService.verifyCode(user.id, recoveryCode)).toBe(true);
    expect(await mfaService.verifyCode(user.id, recoveryCode)).toBe(false);
  });

  it("regenerateRecoveryCodes invalidates the old set", async () => {
    const { user, email } = await createTestUser("regenerate");
    const { secret } = await mfaService.beginSetup(user.id, email);
    const confirmed = await mfaService.confirmSetup(user.id, generateTotp(secret));
    expect(confirmed.success).toBe(true);
    if (!confirmed.success) return;
    const oldCode = confirmed.recoveryCodes[0]!;

    await mfaService.regenerateRecoveryCodes(user.id);
    expect(await mfaService.verifyCode(user.id, oldCode)).toBe(false);
  });

  it("email-OTP: accepts the requested code once, rejects reuse and rejects a wrong code", async () => {
    const { user, email } = await createTestUser("verify-email-otp");
    await enableMfaFor(user.id, email);

    await mfaService.requestEmailOtp(user.id);
    const call = (sendMfaEmailOtp as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    const code = call![1] as string;

    expect(await mfaService.verifyCode(user.id, "999999" === code ? "111111" : "999999")).toBe(false);
    expect(await mfaService.verifyCode(user.id, code)).toBe(true);
    expect(await mfaService.verifyCode(user.id, code)).toBe(false); // pentest — Replay
  });

  it("a fresh email-OTP request supersedes an earlier outstanding one", async () => {
    const { user, email } = await createTestUser("email-otp-supersede");
    await enableMfaFor(user.id, email);

    await mfaService.requestEmailOtp(user.id);
    const firstCode = (sendMfaEmailOtp as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1] as string;
    await mfaService.requestEmailOtp(user.id);
    const secondCode = (sendMfaEmailOtp as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1] as string;

    expect(await mfaService.verifyCode(user.id, firstCode)).toBe(false);
    expect(await mfaService.verifyCode(user.id, secondCode)).toBe(true);
  });
});

describe("mfaService.trustDevice / verifyTrustedDevice", () => {
  it("verifies a trusted-device token for the exact user it was issued to", async () => {
    const { user } = await createTestUser("trust-happy");
    const token = await mfaService.trustDevice(user.id, "Chrome on Mac");
    expect(await mfaService.verifyTrustedDevice(user.id, token)).toBe(true);
  });

  it("pentest — Cross-Account Token Use: rejects a trusted-device token presented for a DIFFERENT user", async () => {
    const { user: userA } = await createTestUser("trust-a");
    const { user: userB } = await createTestUser("trust-b");
    const tokenForA = await mfaService.trustDevice(userA.id, "Device A");
    expect(await mfaService.verifyTrustedDevice(userB.id, tokenForA)).toBe(false);
  });

  it("rejects an unknown/garbage token", async () => {
    const { user } = await createTestUser("trust-garbage");
    expect(await mfaService.verifyTrustedDevice(user.id, "not-a-real-token")).toBe(false);
  });

  it("revokeTrustedDevice is ownership-checked — cannot revoke another user's device", async () => {
    const { user: userA } = await createTestUser("revoke-a");
    const { user: userB } = await createTestUser("revoke-b");
    const tokenForA = await mfaService.trustDevice(userA.id, "Device A");
    const [deviceA] = await mfaService.listTrustedDevices(userA.id);

    const result = await mfaService.revokeTrustedDevice(userB.id, deviceA!.id);
    expect(result.success).toBe(false);
    expect(await mfaService.verifyTrustedDevice(userA.id, tokenForA)).toBe(true); // untouched
  });

  it("revokeTrustedDevice succeeds for the real owner", async () => {
    const { user } = await createTestUser("revoke-owner");
    const token = await mfaService.trustDevice(user.id, "Device");
    const [device] = await mfaService.listTrustedDevices(user.id);

    const result = await mfaService.revokeTrustedDevice(user.id, device!.id);
    expect(result.success).toBe(true);
    expect(await mfaService.verifyTrustedDevice(user.id, token)).toBe(false);
  });
});
