import { emailService } from "@/lib/services/email";
import { createLogger } from "@/lib/logger";

/**
 * RC-1 — every transactional email the authentication stack sends, in
 * one place. Reuses Module 4.2's real emailService.sendEmail() directly
 * — no second email-sending path, no new provider. Every call here is
 * deliberately fire-and-forget-safe from the caller's own perspective
 * (a failed send is logged, never thrown) — a hiccup in email delivery
 * must never turn a real password change, verification, or login into
 * a 500, the same "audit write failures never block the real action"
 * posture this app's own audit-log services already established.
 *
 * `APP_BASE_URL` links point at this deployment's own admin UI — falls
 * back to a relative path if unset, which still works for a same-origin
 * link clicked from the recipient's inbox on the same browser/domain.
 */
function baseUrl(): string {
  return process.env.APP_BASE_URL || "";
}

async function sendSafely(email: string, subject: string, bodyText: string, logEvent: string): Promise<void> {
  const logger = createLogger({ service: "auth", module: "authEmails" });
  try {
    const result = await emailService.sendEmail({ email }, { subject, bodyText });
    if (!result.success) {
      logger.warn(`${logEvent}_send_failed`, { email, error: result.error?.message });
    }
  } catch (error) {
    logger.error(`${logEvent}_send_error`, { email, error: error instanceof Error ? error.message : String(error) });
  }
}

export async function sendEmailVerificationEmail(email: string, rawToken: string): Promise<void> {
  const link = `${baseUrl()}/admin/verify-email?token=${rawToken}`;
  await sendSafely(
    email,
    "Verify your email address",
    `Please confirm your email address by opening this link:\n\n${link}\n\nThis link expires in 24 hours. If you didn't create this account, you can safely ignore this email.`,
    "email_verification",
  );
}

export async function sendPasswordResetEmail(email: string, rawToken: string): Promise<void> {
  const link = `${baseUrl()}/admin/reset-password?token=${rawToken}`;
  await sendSafely(
    email,
    "Reset your password",
    `We received a request to reset your password. Open this link to choose a new one:\n\n${link}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email — your password will not be changed.`,
    "password_reset",
  );
}

export async function sendPasswordChangedEmail(email: string): Promise<void> {
  await sendSafely(
    email,
    "Your password was changed",
    "Your account password was just changed. If this was you, no action is needed. If you didn't make this change, reset your password immediately and contact your administrator.",
    "password_changed",
  );
}

export async function sendNewDeviceLoginEmail(email: string, deviceName: string, ipAddress: string | undefined): Promise<void> {
  await sendSafely(
    email,
    "New sign-in to your account",
    `We noticed a sign-in from a device we haven't seen before:\n\nDevice: ${deviceName}\nIP address: ${ipAddress ?? "unknown"}\n\nIf this was you, no action is needed. If you don't recognize this activity, change your password immediately and review your active sessions.`,
    "new_device_login",
  );
}

export async function sendMfaEmailOtp(email: string, code: string): Promise<void> {
  await sendSafely(
    email,
    "Your sign-in verification code",
    `Your verification code is: ${code}\n\nThis code expires in 10 minutes. Never share this code with anyone.`,
    "mfa_email_otp",
  );
}

export async function sendMfaEnabledEmail(email: string): Promise<void> {
  await sendSafely(
    email,
    "Two-factor authentication enabled",
    "Two-factor authentication was just enabled on your account. If this wasn't you, contact your administrator immediately.",
    "mfa_enabled",
  );
}

export async function sendMfaDisabledEmail(email: string): Promise<void> {
  await sendSafely(
    email,
    "Two-factor authentication disabled",
    "Two-factor authentication was just disabled on your account. If this wasn't you, contact your administrator immediately.",
    "mfa_disabled",
  );
}

export async function sendAccountLockedEmail(email: string, lockedUntil: string): Promise<void> {
  await sendSafely(
    email,
    "Your account was temporarily locked",
    `We locked your account after several failed sign-in attempts. You can try again after ${new Date(lockedUntil).toLocaleString()}. If this wasn't you, consider resetting your password.`,
    "account_locked",
  );
}
