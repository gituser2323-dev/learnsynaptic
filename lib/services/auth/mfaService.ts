import {
  getUserRepository,
  getMfaRecoveryCodeRepository,
  getTrustedDeviceRepository,
  getMfaEmailOtpRepository,
} from "@/lib/db";
import { securityAuditLogService, SECURITY_AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { MFA_EMAIL_OTP_TTL_SECONDS, MFA_TRUSTED_DEVICE_TTL_SECONDS } from "@/config/auth";
import { generateTotpSecret, verifyTotp, buildTotpUri } from "./totp";
import { encryptMfaSecret, decryptMfaSecret } from "./mfaCrypto";
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from "./recoveryCodes";
import { generateOpaqueToken, hashOpaqueToken } from "./opaqueToken";
import { verifyPassword } from "./password";
import { sendMfaEmailOtp, sendMfaEnabledEmail, sendMfaDisabledEmail } from "./authEmails";
import { toPublicUser } from "./types";
import type { PublicUser } from "./types";

const TOTP_ISSUER = "LearnSynaptic";

/**
 * RC-1 — Multi-Factor Authentication: real RFC 6238 TOTP (compatible
 * with Google Authenticator/Authy/any standard app), single-use hashed
 * recovery codes, an email-OTP fallback for a user with no
 * authenticator app, and revocable "trusted device" grants that skip
 * MFA for 30 days on a device that already completed it once. Every
 * credential-shaped value here follows this app's own established
 * "generate random value, persist only its hash/encrypted form" rule —
 * see mfaCrypto.ts/totp.ts/recoveryCodes.ts's own doc comments for the
 * specific primitive each uses and why.
 */
export const mfaService = {
  /**
   * Step 1 of enabling MFA: generates a fresh TOTP secret and stores it
   * encrypted immediately — but does NOT set `mfaEnabled: true` yet.
   * Login stays password-only until `confirmSetup()` verifies the user
   * actually scanned the QR code and can produce a valid code; a secret
   * saved but never confirmed can't accidentally lock the user out of
   * their own account.
   */
  async beginSetup(userId: string, userEmail: string): Promise<{ secret: string; otpauthUri: string }> {
    const secret = generateTotpSecret();
    const userRepository = await getUserRepository();
    await userRepository.update(userId, { mfaSecretEncrypted: encryptMfaSecret(secret) });
    return { secret, otpauthUri: buildTotpUri(secret, userEmail, TOTP_ISSUER) };
  },

  /**
   * Step 2: verifies the user's own first real code against the secret
   * `beginSetup()` just stored, flips `mfaEnabled` to true, and issues
   * 10 recovery codes (replacing any from a prior, since-disabled setup
   * — never leaving a stale set valid). Returns the recovery codes in
   * PLAINTEXT exactly once — this is the only place in the app they
   * ever exist outside their own SHA-256 hash.
   */
  async confirmSetup(userId: string, code: string, context: AuditContext = {}): Promise<{ success: true; recoveryCodes: string[] } | { success: false; error: string }> {
    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    if (!user || !user.mfaSecretEncrypted) return { success: false, error: "No MFA setup in progress for this account." };

    const secret = decryptMfaSecret(user.mfaSecretEncrypted);
    if (!verifyTotp(secret, code)) return { success: false, error: "Invalid verification code." };

    await userRepository.update(userId, { mfaEnabled: true });

    const recoveryCodeRepository = await getMfaRecoveryCodeRepository();
    await recoveryCodeRepository.deleteAllForUser(userId);
    const plainCodes = generateRecoveryCodes();
    await recoveryCodeRepository.createMany(plainCodes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })));

    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.MFA_ENABLED,
      entityType: "User",
      entityId: userId,
      actorId: userId,
      actorType: "user",
      requestId: context.requestId,
      metadata: { email: user.email },
    });
    void sendMfaEnabledEmail(user.email);

    return { success: true, recoveryCodes: plainCodes };
  },

  /** Disables MFA entirely: clears the secret, deletes every recovery
   *  code, and revokes every trusted-device grant (a device trusted
   *  under the old MFA setup must not silently keep skipping a
   *  newly-reconfigured one). Requires the CURRENT password — the same
   *  "prove you're still really you" gate changePassword() already
   *  applies, verified here (not by the route) so callers never need
   *  their own copy of password.ts's verifyPassword. */
  async disable(userId: string, currentPassword: string, context: AuditContext = {}): Promise<{ success: true } | { success: false; error: string }> {
    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    if (!user) return { success: false, error: "User not found." };

    const passwordOk = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordOk) return { success: false, error: "Current password is incorrect." };

    await userRepository.update(userId, { mfaEnabled: false, mfaSecretEncrypted: null });

    const recoveryCodeRepository = await getMfaRecoveryCodeRepository();
    await recoveryCodeRepository.deleteAllForUser(userId);
    const trustedDeviceRepository = await getTrustedDeviceRepository();
    await trustedDeviceRepository.revokeAllForUser(userId);

    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.MFA_DISABLED,
      entityType: "User",
      entityId: userId,
      actorId: userId,
      actorType: "user",
      requestId: context.requestId,
    });
    void sendMfaDisabledEmail(user.email);
    return { success: true };
  },

  /** Regenerates the recovery-code set on demand (e.g. "I used most of
   *  mine") — the old set is invalidated first, the same "supersede,
   *  don't stack" rule password-reset tokens already follow. */
  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const recoveryCodeRepository = await getMfaRecoveryCodeRepository();
    await recoveryCodeRepository.deleteAllForUser(userId);
    const plainCodes = generateRecoveryCodes();
    await recoveryCodeRepository.createMany(plainCodes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })));
    return plainCodes;
  },

  /** The one check authService.login() calls: a real TOTP code, OR a
   *  real unused recovery code (consumed on match — single-use, the
   *  whole point of a backup credential), OR a real, still-valid
   *  email-OTP code (requested separately via requestEmailOtp() —
   *  see /api/auth/mfa/request-email-otp's own doc comment for the
   *  pre-login flow that triggers it). Tries TOTP first (the common
   *  case, cheapest check), then recovery codes, then email OTP. */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    if (!user?.mfaSecretEncrypted) return false;

    const trimmed = code.trim();
    if (/^\d{6}$/.test(trimmed)) {
      const secret = decryptMfaSecret(user.mfaSecretEncrypted);
      if (verifyTotp(secret, trimmed)) return true;
    }

    const recoveryCodeRepository = await getMfaRecoveryCodeRepository();
    const unused = await recoveryCodeRepository.findUnusedByUserId(userId);
    const targetHash = hashRecoveryCode(normalizeRecoveryCode(code));
    const match = unused.find((c) => c.codeHash === targetHash);
    if (match) {
      await recoveryCodeRepository.markUsed(match.id);
      return true;
    }

    if (/^\d{6}$/.test(trimmed) && (await mfaService.verifyEmailOtp(userId, trimmed))) return true;

    return false;
  },

  /** Email-OTP fallback for a user who hasn't set up an authenticator
   *  app. Generates a real 6-digit code, invalidates any outstanding
   *  one for this user first, stores only its hash, and emails the
   *  plaintext — the same pattern password-reset tokens already
   *  establish, just with a short human-typeable code instead of an
   *  opaque URL token (email OTP is read and retyped by a human, a
   *  reset link is clicked). */
  async requestEmailOtp(userId: string): Promise<void> {
    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    if (!user) return;

    const otpRepository = await getMfaEmailOtpRepository();
    await otpRepository.invalidateOutstandingForUser(userId);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + MFA_EMAIL_OTP_TTL_SECONDS * 1000).toISOString();
    await otpRepository.create({ userId, codeHash: hashOpaqueToken(code), expiresAt });
    void sendMfaEmailOtp(user.email, code);
  },

  async verifyEmailOtp(userId: string, code: string): Promise<boolean> {
    const otpRepository = await getMfaEmailOtpRepository();
    const record = await otpRepository.findLatestUnusedForUser(userId);
    if (!record) return false;
    if (new Date(record.expiresAt).getTime() < Date.now()) return false;
    if (record.codeHash !== hashOpaqueToken(code.trim())) return false;
    await otpRepository.markUsed(record.id);
    return true;
  },

  /** Issues a real, revocable "skip MFA on this device for 30 days"
   *  grant — an opaque token, only its hash persisted, exactly the
   *  refresh-token pattern. Returns the raw token for the caller to set
   *  as a long-lived, httpOnly cookie (see AUTH_MFA_TRUSTED_DEVICE_COOKIE_NAME,
   *  config/auth.ts). */
  async trustDevice(userId: string, deviceName?: string): Promise<string> {
    const rawToken = generateOpaqueToken();
    const trustedDeviceRepository = await getTrustedDeviceRepository();
    await trustedDeviceRepository.create({
      userId,
      deviceTokenHash: hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + MFA_TRUSTED_DEVICE_TTL_SECONDS * 1000).toISOString(),
      deviceName,
    });
    return rawToken;
  },

  /** Verifies a presented trusted-device cookie value belongs to THIS
   *  user and hasn't expired — never trusts a token belonging to a
   *  different user, even if somehow presented alongside these
   *  credentials (a stale cookie from a previously-logged-out account
   *  on a shared device, for instance). */
  async verifyTrustedDevice(userId: string, rawToken: string | undefined): Promise<boolean> {
    if (!rawToken) return false;
    const trustedDeviceRepository = await getTrustedDeviceRepository();
    const record = await trustedDeviceRepository.findByTokenHash(hashOpaqueToken(rawToken));
    if (!record || record.userId !== userId) return false;
    if (new Date(record.expiresAt).getTime() < Date.now()) return false;
    await trustedDeviceRepository.touchLastUsed(record.id);
    return true;
  },

  async listTrustedDevices(userId: string) {
    const trustedDeviceRepository = await getTrustedDeviceRepository();
    return trustedDeviceRepository.listByUserId(userId);
  },

  /** Revokes exactly one trusted-device grant — "forget this device."
   *  Ownership is verified first (the grant must belong to the
   *  requesting user), the same convention sessionService.revokeSession()
   *  already establishes for the sibling "log out this device" action,
   *  so one user can never revoke another's trusted-device grant by
   *  guessing/enumerating an id. */
  async revokeTrustedDevice(userId: string, id: string): Promise<{ success: boolean }> {
    const trustedDeviceRepository = await getTrustedDeviceRepository();
    const devices = await trustedDeviceRepository.listByUserId(userId);
    if (!devices.some((d) => d.id === id)) return { success: false };
    await trustedDeviceRepository.revoke(id);
    return { success: true };
  },

  async getStatus(userId: string): Promise<PublicUser | null> {
    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    return user ? toPublicUser(user) : null;
  },
};
