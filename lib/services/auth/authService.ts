import { randomUUID } from "crypto";
import {
  getUserRepository,
  getRefreshTokenRepository,
  getPasswordResetTokenRepository,
  getEmailVerificationTokenRepository,
  DuplicateKeyError,
} from "@/lib/db";
import { securityAuditLogService, auditLogService, SECURITY_AUDIT_ACTIONS, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import {
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS_SHORT,
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
} from "@/config/auth";
import { hashPassword, verifyPassword } from "./password";
import { signAccessToken } from "./tokens";
import { ensureDefaultOrganization } from "@/lib/services/organizations";
import { getTenantContext } from "@/lib/tenancy/context";
import { entitlementService } from "@/lib/services/billing";
import { generateRefreshToken, hashRefreshToken } from "./refreshTokenCrypto";
import { generateOpaqueToken, hashOpaqueToken } from "./opaqueToken";
import { parseUserAgent } from "@/lib/api/userAgent";
import { mfaService } from "./mfaService";
import {
  validateLoginCredentials,
  validateCreateUserInput,
  validateSelfRegistrationInput,
  validateAcceptInvitationInput,
  validatePasswordReset,
  validateForgotPasswordInput,
  validateCompletePasswordResetInput,
  validateChangePasswordInput,
} from "./validation";
import {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendEmailVerificationEmail,
  sendNewDeviceLoginEmail,
  sendAccountLockedEmail,
} from "./authEmails";
import { toPublicUser } from "./types";
import type {
  AuthTokens,
  AuthValidationError,
  CreateUserResult,
  CreateUserFromInvitationResult,
  LoginResult,
  RefreshResult,
  RegisterResult,
  User,
} from "./types";

/**
 * Application layer for authentication — the module every auth route
 * calls. Must stay callable from contexts that know nothing about HTTP
 * (scripts/createAdminUser.ts, a future admin script), same principle as
 * every other *Service module in this codebase: no import from lib/api
 * anywhere in this file.
 *
 * RC-1 — Production Hardening: Authentication & Identity — extends this
 * module (never replaces it): brute-force lockout, MFA gating, Remember
 * Me, device/session metadata, new-device detection, and real
 * self-service password-reset/change/email-verification flows, on top
 * of the exact login/refresh/logout/createUser this file already had.
 *
 * The generic "Invalid email or password." message is used for every
 * login failure mode (no such user, disabled account, wrong password) —
 * distinguishing them to the caller would let an attacker enumerate
 * which emails have accounts. The real reason is still recorded, just
 * only in the security-audit metadata (internal-only, never echoed back
 * in the response).
 */

/** RC-7 — Customer Onboarding & SaaS Activation. Historically this
 *  fell back to `ensureDefaultOrganization()` for any user with no
 *  `organizationId` set, on the theory that every User row predated
 *  real tenant enforcement. That's no longer true: `authService.createUser()`
 *  has stamped a real `organizationId` on every account it creates
 *  since Module 8.3 shipped, confirmed against the live deployment (0
 *  of N real users have none set) — the only way to reach this
 *  function with `user.organizationId` unset today is a genuinely
 *  brand-new, self-registered RC-7 account that hasn't created (or
 *  joined) an organization yet.
 *
 *  Silently resolving such a user onto the deployment's real default
 *  organization would be a serious cross-tenant leak — a stranger who
 *  just registered would get a live session scoped into LearnSynaptic's
 *  own production tenant data before ever creating their own. So this
 *  now returns `undefined` rather than substituting anything: the
 *  resulting access token simply carries no `organizationId` claim,
 *  and `withApiRoute.ts`'s own gate (see its "RC-7 — pre-onboarding"
 *  doc comment) is what actually decides which routes such a token may
 *  reach — never this function silently deciding for it. */
function resolveOrganizationId(user: User): string | undefined {
  return user.organizationId;
}

interface IssueTokensOptions {
  rememberMe: boolean;
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
}

async function issueTokens(user: User, familyId: string, options: IssueTokensOptions): Promise<AuthTokens> {
  const refreshTokenRepository = await getRefreshTokenRepository();
  const rawRefreshToken = generateRefreshToken();
  const ttlSeconds = options.rememberMe ? REFRESH_TOKEN_TTL_SECONDS : REFRESH_TOKEN_TTL_SECONDS_SHORT;
  const refreshTokenExpiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const session = await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashRefreshToken(rawRefreshToken),
    familyId,
    expiresAt: refreshTokenExpiresAt,
    rememberMe: options.rememberMe,
    deviceName: options.deviceName,
    browser: options.browser,
    os: options.os,
    ipAddress: options.ipAddress,
  });

  const { token: accessToken, expiresAt: accessTokenExpiresAt } = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    organizationId: resolveOrganizationId(user),
    sessionId: session.id,
    platformRole: user.platformRole,
  });

  return { accessToken, accessTokenExpiresAt, refreshToken: rawRefreshToken, refreshTokenExpiresAt };
}

const GENERIC_LOGIN_ERROR = [{ field: "root", message: "Invalid email or password." }];

/** RC-1 — a real per-account brute-force check, distinct from
 *  lib/api/rateLimit's own per-IP window (login/route.ts's own
 *  `rateLimit: {limit:10, windowMs:15*60_000}`): the IP limiter catches
 *  a single attacker hammering one IP; this catches a distributed
 *  attack (many IPs, one targeted account) the IP limiter structurally
 *  can't. Both layers run — neither replaces the other. */
async function checkAndRecordFailedLogin(user: User, context: AuditContext): Promise<{ locked: true; lockedUntil: string } | { locked: false }> {
  const userRepository = await getUserRepository();
  const nextAttempts = user.failedLoginAttempts + 1;

  if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_SECONDS * 1000).toISOString();
    await userRepository.update(user.id, { failedLoginAttempts: 0, lockedUntil });
    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.ACCOUNT_LOCKED,
      entityType: "User",
      entityId: user.id,
      actorType: "user",
      requestId: context.requestId,
      metadata: { email: user.email, ipAddress: context.ipAddress },
    });
    void sendAccountLockedEmail(user.email, lockedUntil);
    return { locked: true, lockedUntil };
  }

  await userRepository.update(user.id, { failedLoginAttempts: nextAttempts });
  return { locked: false };
}

/** RC-1 — "have we seen this exact device (by parsed User-Agent) sign
 *  in before, from any of this user's own active sessions." A real,
 *  if approximate, signal — not a hardware fingerprint (this app has
 *  no client-side fingerprinting script, deliberately: that's a much
 *  larger, more invasive feature than this module's own scope), but
 *  genuinely useful for "you're signing in from somewhere new" alerts.
 *  A user's very first-ever login has no prior sessions to compare
 *  against and is never flagged as "new" — everyone's first login is
 *  definitionally new, not suspicious. */
async function isNewDevice(userId: string, deviceName: string | undefined): Promise<boolean> {
  const refreshTokenRepository = await getRefreshTokenRepository();
  const sessions = await refreshTokenRepository.listByUserId(userId);
  if (sessions.length === 0) return false;
  return !sessions.some((s) => s.deviceName === deviceName);
}

export const authService = {
  async login(credentials: unknown, context: AuditContext = {}): Promise<LoginResult> {
    const validation = validateLoginCredentials(credentials);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const userRepository = await getUserRepository();
    const user = await userRepository.findByEmail(validation.data.email);

    if (!user || user.status !== "active") {
      await securityAuditLogService.record({
        action: SECURITY_AUDIT_ACTIONS.USER_LOGIN_FAILED,
        entityType: "User",
        entityId: user?.id ?? validation.data.email,
        actorType: "user",
        requestId: context.requestId,
        metadata: { email: validation.data.email, reason: user ? "user_disabled" : "no_such_user", ipAddress: context.ipAddress, userAgent: context.userAgent },
      });
      return { success: false, errors: GENERIC_LOGIN_ERROR };
    }

    // RC-1 — checked BEFORE password verification: a locked account
    // rejects immediately rather than spending a bcrypt comparison
    // (cost factor 12, deliberately slow) on a request that's going to
    // be rejected regardless, and avoids resetting the lock's own timer
    // from repeated hits during the lockout window.
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      return { success: false, locked: true, lockedUntil: user.lockedUntil };
    }

    const passwordOk = await verifyPassword(validation.data.password, user.passwordHash);
    if (!passwordOk) {
      await checkAndRecordFailedLogin(user, context);
      await securityAuditLogService.record({
        action: SECURITY_AUDIT_ACTIONS.USER_LOGIN_FAILED,
        entityType: "User",
        entityId: user.id,
        actorType: "user",
        requestId: context.requestId,
        metadata: { email: user.email, reason: "bad_password", ipAddress: context.ipAddress, userAgent: context.userAgent },
      });
      return { success: false, errors: GENERIC_LOGIN_ERROR };
    }

    // Password verified — clear any stale failed-attempt/lockout state.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await userRepository.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    }

    // RC-1 — MFA gate. A trusted-device cookie skips it entirely; a
    // submitted code (TOTP or recovery code) is verified; neither
    // present means the client must prompt for one and retry `login()`
    // with the same credentials plus `mfaCode` — see LoginResult's own
    // `mfaRequired` doc comment for why this is a second call to the
    // SAME endpoint, not a separate "step 2" route.
    if (user.mfaEnabled) {
      const trustedDeviceOk = await mfaService.verifyTrustedDevice(user.id, validation.data.trustedDeviceToken);
      if (!trustedDeviceOk) {
        if (!validation.data.mfaCode) {
          return { success: false, mfaRequired: true };
        }
        const mfaOk = await mfaService.verifyCode(user.id, validation.data.mfaCode);
        if (!mfaOk) {
          await securityAuditLogService.record({
            action: SECURITY_AUDIT_ACTIONS.MFA_CHALLENGE_FAILED,
            entityType: "User",
            entityId: user.id,
            actorId: user.id,
            actorType: "user",
            requestId: context.requestId,
            metadata: { ipAddress: context.ipAddress },
          });
          return { success: false, errors: [{ field: "mfaCode", message: "Invalid verification code." }] };
        }
      }
    }

    const { browser, os, deviceName } = parseUserAgent(context.userAgent ?? null);
    const newDevice = await isNewDevice(user.id, deviceName);

    const tokens = await issueTokens(user, randomUUID(), {
      rememberMe: validation.data.rememberMe ?? false,
      deviceName,
      browser,
      os,
      ipAddress: context.ipAddress,
    });

    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.USER_LOGIN_SUCCEEDED,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorType: "user",
      requestId: context.requestId,
      metadata: { email: user.email, role: user.role, ipAddress: context.ipAddress, userAgent: context.userAgent, deviceName, newDevice },
    });

    if (newDevice) {
      await securityAuditLogService.record({
        action: SECURITY_AUDIT_ACTIONS.NEW_DEVICE_LOGIN,
        entityType: "User",
        entityId: user.id,
        actorId: user.id,
        actorType: "user",
        requestId: context.requestId,
        metadata: { deviceName, ipAddress: context.ipAddress },
      });
      void sendNewDeviceLoginEmail(user.email, deviceName, context.ipAddress);
    }

    return { success: true, user: toPublicUser(user), tokens, newDevice };
  },

  /**
   * Refresh-token rotation with reuse detection (OWASP-recommended):
   * each refresh consumes the presented token (marks it revoked) and
   * issues a new one in the same family. If a token that's already
   * revoked is presented again, that's the standard signal the token was
   * copied — the entire family is revoked immediately (every descendant
   * session from that original login is force-logged-out), not just the
   * one record.
   */
  async refreshSession(rawRefreshToken: string | undefined, context: AuditContext = {}): Promise<RefreshResult> {
    if (!rawRefreshToken) return { success: false, reason: "invalid" };

    const refreshTokenRepository = await getRefreshTokenRepository();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const record = await refreshTokenRepository.findByTokenHash(tokenHash);
    if (!record) return { success: false, reason: "invalid" };

    if (record.revokedAt) {
      await refreshTokenRepository.revokeFamily(record.familyId);
      await securityAuditLogService.record({
        action: SECURITY_AUDIT_ACTIONS.REFRESH_TOKEN_REUSE_DETECTED,
        entityType: "User",
        entityId: record.userId,
        actorId: record.userId,
        actorType: "user",
        requestId: context.requestId,
        metadata: { familyId: record.familyId, refreshTokenRecordId: record.id, ipAddress: context.ipAddress },
      });
      return { success: false, reason: "reused" };
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      return { success: false, reason: "expired" };
    }

    const userRepository = await getUserRepository();
    const user = await userRepository.findById(record.userId);
    if (!user || user.status !== "active") {
      return { success: false, reason: "user_inactive" };
    }

    // RC-1 — records when this (about-to-be-revoked) session was last
    // actually used, so the Active Sessions/history view can show real
    // "last active" timestamps rather than only ever a creation time.
    await refreshTokenRepository.touchLastUsed(record.id);
    await refreshTokenRepository.revoke(record.id);
    const tokens = await issueTokens(user, record.familyId, {
      rememberMe: record.rememberMe,
      deviceName: record.deviceName,
      browser: record.browser,
      os: record.os,
      ipAddress: context.ipAddress ?? record.ipAddress,
    });

    return { success: true, user: toPublicUser(user), tokens };
  },

  async logout(rawRefreshToken: string | undefined, context: AuditContext = {}): Promise<void> {
    if (!rawRefreshToken) return;

    const refreshTokenRepository = await getRefreshTokenRepository();
    const record = await refreshTokenRepository.findByTokenHash(hashRefreshToken(rawRefreshToken));
    if (!record || record.revokedAt) return;

    await refreshTokenRepository.revoke(record.id);
    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.USER_LOGGED_OUT,
      entityType: "User",
      entityId: record.userId,
      actorId: record.userId,
      actorType: "user",
      requestId: context.requestId,
    });
  },

  /**
   * Not exposed via any HTTP route — no public self-registration exists
   * for staff accounts. Called only from scripts/createAdminUser.ts
   * today. A business-category event (USER_CREATED), not a
   * security-category one: creating an account is a business-record
   * creation, the same tier as LEAD_CREATED/CAMPAIGN_CREATED, not a
   * login/session event.
   */
  async createUser(input: unknown, context: AuditContext = {}): Promise<CreateUserResult> {
    const validation = validateCreateUserInput(input);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Business OS Phase 8, Module 8.3 — the same "tenant context, or
    // the deployment's default organization" resolution withApiRoute.ts
    // and every public-route service already use. Falls back safely
    // for scripts/createAdminUser.ts's own out-of-band, no-HTTP-request
    // bootstrap path (no tenant context exists there at all).
    const organizationId = getTenantContext()?.organizationId ?? (await ensureDefaultOrganization()).id;

    // Real, server-enforced seat limit — never a scattered UI-only
    // check. Seats are a STOCK metric (current headcount, goes up and
    // down as staff are added/deactivated), not a per-period FLOW
    // metric, so this compares the plan's own limit against a live
    // count of this organization's active users rather than routing
    // through usageService's period-scoped counters (which exist for
    // metrics that genuinely reset monthly — see usageService.ts's own
    // doc comment). Staff headcount per organization is always small,
    // so this is a cheap, bounded count, not the "expensive
    // full-database counting" the mission warns against for
    // high-volume metrics like leads/messages.
    const seatLimit = await entitlementService.getLimit(organizationId, "seats");
    if (seatLimit !== null) {
      const userRepositoryForCount = await getUserRepository();
      const activeSeats = (await userRepositoryForCount.listActive()).filter((u) => u.organizationId === organizationId).length;
      if (activeSeats >= seatLimit) {
        return {
          success: false,
          errors: [{ field: "root", message: `Your plan allows ${seatLimit} team member${seatLimit === 1 ? "" : "s"}. Upgrade your plan to add more.` }],
        };
      }
    }

    const passwordHash = await hashPassword(validation.data.password);
    const userRepository = await getUserRepository();

    try {
      const user = await userRepository.create({
        email: validation.data.email,
        passwordHash,
        role: validation.data.role,
        name: validation.data.name,
        organizationId,
      });

      await auditLogService.record({
        action: AUDIT_ACTIONS.USER_CREATED,
        entityType: "User",
        entityId: user.id,
        requestId: context.requestId,
        metadata: { email: user.email, role: user.role },
      });

      return { success: true, user: toPublicUser(user) };
    } catch (error) {
      if (error instanceof DuplicateKeyError) {
        return {
          success: false,
          errors: [{ field: "email", message: `A user with email "${validation.data.email}" already exists.` }],
        };
      }
      throw error;
    }
  },

  /**
   * RC-7 — Customer Onboarding & SaaS Activation. The self-service
   * counterpart to createUser() above: a real, public
   * `POST /api/auth/register` route calls this (createUser() itself
   * stays CLI/admin-only, untouched). Deliberately creates the User
   * with NO `organizationId` at all — see resolveOrganizationId()'s own
   * doc comment for why silently defaulting them onto the deployment's
   * real organization would be a cross-tenant leak — and `role: "admin"`
   * fixed rather than client-supplied: a self-registering user always
   * becomes the Admin of whatever organization they create next (the
   * mission's own "the creator should receive the appropriate tenant
   * Admin membership" requirement), so there's no real choice to expose
   * here, and letting the client choose its own role would be exactly
   * the "accept organization/role ownership from untrusted client
   * input" pattern this codebase's tenant architecture already refuses
   * elsewhere (see tenantScopePlugin.ts's own doc comment on stamping
   * server-trusted context, never client-supplied values).
   *
   * Auto-signs-in the new account (issues real tokens, same shape
   * login() returns) rather than requiring a separate login
   * immediately after registering — the account is real and the
   * password was just verified by the user typing it, so there's no
   * security reason to make them re-enter it a second time. Email
   * verification is requested (fire-and-forget) but NOT required to
   * reach this session — it's required before organization creation
   * instead (see onboardingService.createOrganization()'s own doc
   * comment), matching the mission's own funnel order (ACCOUNT ->
   * VERIFIED IDENTITY -> ORGANIZATION) and its "require verification
   * before sensitive SaaS setup" instruction specifically, not before
   * account creation itself.
   */
  async registerUser(input: unknown, context: AuditContext = {}): Promise<RegisterResult> {
    const validation = validateSelfRegistrationInput(input);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const passwordHash = await hashPassword(validation.data.password);
    const userRepository = await getUserRepository();

    let user: User;
    try {
      user = await userRepository.create({
        email: validation.data.email,
        passwordHash,
        role: "admin",
        name: validation.data.name,
      });
    } catch (error) {
      if (error instanceof DuplicateKeyError) {
        return {
          success: false,
          errors: [{ field: "email", message: `An account with email "${validation.data.email}" already exists.` }],
        };
      }
      throw error;
    }

    await auditLogService.record({
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: "User",
      entityId: user.id,
      requestId: context.requestId,
      metadata: { email: user.email, role: user.role, source: "self_registration" },
    });

    void this.requestEmailVerification(user.id, context);

    const { browser, os, deviceName } = parseUserAgent(context.userAgent ?? null);
    const tokens = await issueTokens(user, randomUUID(), {
      rememberMe: false,
      deviceName,
      browser,
      os,
      ipAddress: context.ipAddress,
    });

    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.USER_SELF_REGISTERED,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorType: "user",
      requestId: context.requestId,
      metadata: { email: user.email, ipAddress: context.ipAddress, userAgent: context.userAgent },
    });

    return { success: true, user: toPublicUser(user), tokens };
  },

  /**
   * RC-7 — Customer Onboarding & SaaS Activation. The accept-a-team-
   * invitation counterpart to registerUser() above: creates a real
   * account with `organizationId`/`role` ALREADY set (never absent the
   * way a fresh self-registration's is) because a validated,
   * unexpired, still-pending TeamInvitation already establishes both —
   * unlike registerUser(), there is no "verify email before you can do
   * anything sensitive" gap to worry about here, since receiving and
   * clicking a real invitation link already proves control of the
   * email address the same way clicking a verification link would;
   * `emailVerifiedAt` is stamped immediately rather than requiring a
   * second, redundant verification email.
   *
   * `invitationService.acceptInvitation()` is this function's only
   * real caller — it validates the invitation itself (token, expiry,
   * pending status, seat limit) BEFORE ever calling this, so this
   * function trusts `organizationId`/`role` completely rather than
   * re-deriving them from anything client-supplied.
   */
  async createUserFromInvitation(
    email: string,
    organizationId: string,
    role: User["role"],
    input: unknown,
    context: AuditContext = {},
  ): Promise<CreateUserFromInvitationResult> {
    const validation = validateAcceptInvitationInput(input);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const passwordHash = await hashPassword(validation.data.password);
    const userRepository = await getUserRepository();

    let user: User;
    try {
      user = await userRepository.create({
        email,
        passwordHash,
        role,
        name: validation.data.name,
        organizationId,
      });
    } catch (error) {
      if (error instanceof DuplicateKeyError) {
        return {
          success: false,
          errors: [{ field: "root", message: `An account with email "${email}" already exists.` }],
        };
      }
      throw error;
    }

    user = await userRepository.update(user.id, { emailVerifiedAt: new Date().toISOString() });

    await auditLogService.record({
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: "User",
      entityId: user.id,
      requestId: context.requestId,
      metadata: { email: user.email, role: user.role, source: "team_invitation" },
    });

    const { browser, os, deviceName } = parseUserAgent(context.userAgent ?? null);
    const tokens = await issueTokens(user, randomUUID(), {
      rememberMe: false,
      deviceName,
      browser,
      os,
      ipAddress: context.ipAddress,
    });

    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.USER_SELF_REGISTERED,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorType: "user",
      requestId: context.requestId,
      metadata: { email: user.email, ipAddress: context.ipAddress, userAgent: context.userAgent, source: "team_invitation" },
    });

    return { success: true, user: toPublicUser(user), tokens };
  },

  /**
   * Operator-initiated password reset via CLI script — kept exactly as
   * it was (scripts/resetAdminPassword.ts's only caller), untouched by
   * RC-1's own new SELF-service flow below (requestPasswordReset /
   * completePasswordReset). Does NOT revoke the user's existing
   * sessions — an operator-initiated reset via shell access is a
   * different trust context than "my account may be compromised,"
   * which is exactly what the self-service flow below does revoke
   * sessions for.
   */
  async resetPassword(input: unknown, context: AuditContext = {}): Promise<CreateUserResult> {
    const validation = validatePasswordReset(input);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const userRepository = await getUserRepository();
    const existing = await userRepository.findByEmail(validation.data.email);
    if (!existing) {
      const errors: AuthValidationError[] = [
        { field: "email", message: `No user found with email "${validation.data.email}".` },
      ];
      return { success: false, errors };
    }

    const passwordHash = await hashPassword(validation.data.newPassword);
    const updated = await userRepository.updatePassword(existing.id, passwordHash);

    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.USER_PASSWORD_RESET,
      entityType: "User",
      entityId: updated.id,
      requestId: context.requestId,
      metadata: { email: updated.email },
    });

    return { success: true, user: toPublicUser(updated) };
  },

  /**
   * RC-1 — real self-service "forgot password." Deliberately reports
   * success regardless of whether the email matches a real account —
   * the same anti-enumeration principle login()'s own generic error
   * message already applies, just for a different route (an attacker
   * probing "does this email have an account" via response
   * differences). `invalidateOutstandingForUser` ensures at most one
   * outstanding reset link is ever valid at a time — requesting again
   * supersedes an earlier, still-unused email rather than leaving both
   * valid.
   */
  async requestPasswordReset(input: unknown, context: AuditContext = {}): Promise<{ success: true }> {
    const validation = validateForgotPasswordInput(input);
    if (!validation.valid) return { success: true }; // malformed email still reports success — never confirms shape of a real account

    const userRepository = await getUserRepository();
    const user = await userRepository.findByEmail(validation.data.email);
    if (user && user.status === "active") {
      const tokenRepository = await getPasswordResetTokenRepository();
      await tokenRepository.invalidateOutstandingForUser(user.id);
      const rawToken = generateOpaqueToken();
      await tokenRepository.create({
        userId: user.id,
        tokenHash: hashOpaqueToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000).toISOString(),
      });
      await securityAuditLogService.record({
        action: SECURITY_AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
        entityType: "User",
        entityId: user.id,
        actorType: "user",
        requestId: context.requestId,
        metadata: { email: user.email, ipAddress: context.ipAddress },
      });
      void sendPasswordResetEmail(user.email, rawToken);
    }
    return { success: true };
  },

  /**
   * RC-1 — completes a self-service reset: verifies the token is real,
   * unused, and unexpired, sets the new password, marks the token used,
   * and — unlike the CLI-operator resetPassword() above — revokes
   * EVERY session for this user (a password reset is exactly the
   * "assume the account may have been compromised" moment sessions
   * should NOT survive; the CLI path above is a different trust
   * context, see that method's own doc comment for why it doesn't).
   */
  async completePasswordReset(input: unknown, context: AuditContext = {}): Promise<{ success: true } | { success: false; errors: AuthValidationError[] }> {
    const validation = validateCompletePasswordResetInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const tokenRepository = await getPasswordResetTokenRepository();
    const record = await tokenRepository.findByTokenHash(hashOpaqueToken(validation.data.token));
    if (!record || record.usedAt || new Date(record.expiresAt).getTime() < Date.now()) {
      return { success: false, errors: [{ field: "token", message: "This reset link is invalid or has expired. Request a new one." }] };
    }

    const userRepository = await getUserRepository();
    const user = await userRepository.findById(record.userId);
    if (!user) return { success: false, errors: [{ field: "token", message: "This reset link is invalid or has expired. Request a new one." }] };

    const passwordHash = await hashPassword(validation.data.newPassword);
    await userRepository.updatePassword(user.id, passwordHash);
    await userRepository.update(user.id, { passwordChangedAt: new Date().toISOString(), failedLoginAttempts: 0, lockedUntil: null });
    await tokenRepository.markUsed(record.id);

    const refreshTokenRepository = await getRefreshTokenRepository();
    await refreshTokenRepository.revokeAllForUser(user.id);

    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorType: "user",
      requestId: context.requestId,
      metadata: { email: user.email, ipAddress: context.ipAddress },
    });
    void sendPasswordChangedEmail(user.email);

    return { success: true };
  },

  /**
   * RC-1 — self-service "change password" for an already-authenticated
   * user (Security Settings). Requires the CURRENT password (never just
   * the new one) — the real defense against a hijacked-but-still-open
   * browser session being used to lock the real owner out permanently.
   * Revokes every OTHER session (never the one making this request —
   * `currentSessionId`), the same "password changed = other sessions
   * should not survive" posture completePasswordReset() takes, refined
   * here to not immediately log the user out of the tab they just used.
   */
  async changePassword(
    userId: string,
    input: unknown,
    currentSessionId: string | undefined,
    context: AuditContext = {},
  ): Promise<{ success: true } | { success: false; errors: AuthValidationError[] }> {
    const validation = validateChangePasswordInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    if (!user) return { success: false, errors: [{ field: "root", message: "User not found." }] };

    const currentOk = await verifyPassword(validation.data.currentPassword, user.passwordHash);
    if (!currentOk) return { success: false, errors: [{ field: "currentPassword", message: "Current password is incorrect." }] };

    const passwordHash = await hashPassword(validation.data.newPassword);
    await userRepository.updatePassword(user.id, passwordHash);
    await userRepository.update(user.id, { passwordChangedAt: new Date().toISOString() });

    const refreshTokenRepository = await getRefreshTokenRepository();
    await refreshTokenRepository.revokeAllForUser(user.id, currentSessionId);

    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.USER_PASSWORD_CHANGED,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorType: "user",
      requestId: context.requestId,
      metadata: { email: user.email, ipAddress: context.ipAddress },
    });
    void sendPasswordChangedEmail(user.email);

    return { success: true };
  },

  /** RC-1 — issues (or re-issues) an email-verification link. Silent
   *  no-op for an already-verified address — the caller (resendRoute)
   *  reports "already verified" using the user's own current state,
   *  never a second email for no reason. */
  async requestEmailVerification(userId: string, context: AuditContext = {}): Promise<{ status: "sent" | "already_verified" | "not_found" }> {
    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    if (!user) return { status: "not_found" };
    if (user.emailVerifiedAt) return { status: "already_verified" };

    const tokenRepository = await getEmailVerificationTokenRepository();
    await tokenRepository.invalidateOutstandingForUser(userId);
    const rawToken = generateOpaqueToken();
    await tokenRepository.create({
      userId,
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_SECONDS * 1000).toISOString(),
    });
    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.EMAIL_VERIFICATION_REQUESTED,
      entityType: "User",
      entityId: userId,
      actorId: userId,
      actorType: "user",
      requestId: context.requestId,
    });
    void sendEmailVerificationEmail(user.email, rawToken);
    return { status: "sent" };
  },

  /** RC-1 — completes email verification. Distinguishes "invalid,"
   *  "expired," and "already used" for the UI (unlike login's own
   *  deliberate error-message collapsing — there's no enumeration risk
   *  in telling a user who already clicked their own link that it was
   *  already used). */
  async verifyEmail(rawToken: string, context: AuditContext = {}): Promise<{ status: "verified" | "invalid" | "expired" | "already_used" }> {
    const tokenRepository = await getEmailVerificationTokenRepository();
    const record = await tokenRepository.findByTokenHash(hashOpaqueToken(rawToken));
    if (!record) return { status: "invalid" };
    if (record.usedAt) return { status: "already_used" };
    if (new Date(record.expiresAt).getTime() < Date.now()) return { status: "expired" };

    const userRepository = await getUserRepository();
    const user = await userRepository.findById(record.userId);
    if (!user) return { status: "invalid" };

    await userRepository.update(user.id, { emailVerifiedAt: new Date().toISOString() });
    await tokenRepository.markUsed(record.id);
    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.EMAIL_VERIFIED,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorType: "user",
      requestId: context.requestId,
    });
    return { status: "verified" };
  },

  /** Enterprise CRM (Phase 1) — the staff directory Lead Assignment
   *  (manual + round robin) and Counsellor Tasks both read from. Never
   *  returns passwordHash — same PublicUser projection every other
   *  auth-facing response already uses.
   *
   * RC-9 — a real, live-proven CRITICAL cross-tenant leak found via
   * direct UI testing (not just scripted API attacks): `UserModel`
   * (lib/db/models/user.model.ts) was never wired to `tenantScopePlugin`
   * — `userRepository.listActive()` is a genuinely global, unscoped
   * query by design, because Platform Super Admin's own dashboard/
   * search/onboarding services (platformAdmin/*) correctly call it
   * directly for real cross-org visibility. This method is the OTHER,
   * tenant-facing caller of that same repository call — GET
   * /api/admin/users (the Lead Assignment / Task assignee staff-picker
   * endpoint), gated only at `requiredRole: "manager"`, not at
   * organization boundary — so any Manager/Admin in ANY organization
   * received every OTHER organization's full staff directory (name,
   * real email, role) with no filtering at all. Confirmed live: Org A's
   * own admin session's Lead-list "assigned counsellor" filter dropdown
   * listed Org B's and Org C's real staff by name. Filtered here to the
   * caller's own real organization (via the ambient tenant context
   * `withApiRoute` already establishes for every authenticated
   * request) rather than in the repository layer, so Platform Admin's
   * own legitimate cross-org callers (which never run inside a
   * single-org tenant context) are unaffected. */
  async listActiveStaff() {
    const userRepository = await getUserRepository();
    const users = await userRepository.listActive();
    const context = getTenantContext();
    const scoped = context?.organizationId ? users.filter((u) => u.organizationId === context.organizationId) : users;
    return scoped.map(toPublicUser);
  },

  /** RC-1 — the one place outside login() itself that needs to
   *  re-verify a real password against a real account pre-session:
   *  /api/auth/mfa/request-email-otp's own pre-login trigger (see that
   *  route's doc comment for why it can't be requiredRole-gated).
   *  Deliberately returns only the minimal PublicUser + mfaEnabled a
   *  caller needs, never the full User row — keeping passwordHash
   *  verification itself encapsulated here rather than letting a route
   *  reach into password.ts directly. */
  async verifyCredentialsForChallenge(email: string, password: string): Promise<{ id: string; mfaEnabled: boolean } | null> {
    const userRepository = await getUserRepository();
    const user = await userRepository.findByEmail(email.trim().toLowerCase());
    if (!user || user.status !== "active") return null;
    const ok = await verifyPassword(password, user.passwordHash);
    return ok ? { id: user.id, mfaEnabled: user.mfaEnabled } : null;
  },

  /** RC-1 — Social Login's own "finish the login" step. Called only by
   *  oauthService.ts once it has resolved a real, already-linked
   *  OAuthAccount to a real, active User (see that module's own
   *  handleCallback()) and, if the account has MFA enabled, only AFTER
   *  the caller has separately verified an MFA code — the same
   *  "authenticate first, MFA second" order login() itself enforces,
   *  just split across two calls here because the OAuth redirect flow
   *  has no single request that carries both a resolved identity and an
   *  MFA code together the way a login() form submission does (see
   *  oauth/mfaPending.ts's own doc comment).
   *
   *  Mirrors login()'s own post-credential-verification tail (new-device
   *  detection, issueTokens, audit logging) rather than sharing code
   *  with it directly — the two entry points authenticate the user
   *  through completely different credentials (a federated provider's
   *  token exchange vs. a local password), so login() itself isn't
   *  reused, only the same resulting session shape. `authMethod` is
   *  recorded in the audit metadata so Login History can distinguish
   *  e.g. "oauth:google" from a normal password sign-in. */
  async issueSessionForVerifiedUser(
    user: User,
    authMethod: string,
    context: AuditContext = {},
  ): Promise<{ user: ReturnType<typeof toPublicUser>; tokens: AuthTokens; newDevice: boolean }> {
    const { browser, os, deviceName } = parseUserAgent(context.userAgent ?? null);
    const newDevice = await isNewDevice(user.id, deviceName);

    const tokens = await issueTokens(user, randomUUID(), {
      rememberMe: true,
      deviceName,
      browser,
      os,
      ipAddress: context.ipAddress,
    });

    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.USER_LOGIN_SUCCEEDED,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorType: "user",
      requestId: context.requestId,
      metadata: { email: user.email, role: user.role, ipAddress: context.ipAddress, userAgent: context.userAgent, deviceName, newDevice, authMethod },
    });

    if (newDevice) {
      await securityAuditLogService.record({
        action: SECURITY_AUDIT_ACTIONS.NEW_DEVICE_LOGIN,
        entityType: "User",
        entityId: user.id,
        actorId: user.id,
        actorType: "user",
        requestId: context.requestId,
        metadata: { deviceName, ipAddress: context.ipAddress },
      });
      void sendNewDeviceLoginEmail(user.email, deviceName, context.ipAddress);
    }

    return { user: toPublicUser(user), tokens, newDevice };
  },
};
