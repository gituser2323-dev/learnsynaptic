import { getRefreshTokenRepository } from "@/lib/db";
import { securityAuditLogService, SECURITY_AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import type { RefreshTokenRecord } from "./types";

/** RC-1 — Login History. Reuses Module 9's own securityAuditLogService
 *  (already the real producer of login-succeeded/failed/logged-out/
 *  password-reset events since before this module existed) rather than
 *  a second, competing history table — this is purely a read/shape
 *  layer on top of it, filtered to the action set the mission's own
 *  "Login History" section names, and with IP/device/browser now
 *  actually present in the metadata (RC-1's own real addition — see
 *  authService.ts's own login()/logout() call sites). */
const LOGIN_HISTORY_ACTIONS: readonly string[] = [
  SECURITY_AUDIT_ACTIONS.USER_LOGIN_SUCCEEDED,
  SECURITY_AUDIT_ACTIONS.USER_LOGIN_FAILED,
  SECURITY_AUDIT_ACTIONS.USER_LOGGED_OUT,
  SECURITY_AUDIT_ACTIONS.USER_PASSWORD_RESET,
  SECURITY_AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
  SECURITY_AUDIT_ACTIONS.NEW_DEVICE_LOGIN,
  SECURITY_AUDIT_ACTIONS.ACCOUNT_LOCKED,
  SECURITY_AUDIT_ACTIONS.MFA_CHALLENGE_FAILED,
];

export interface LoginHistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
  reason?: string;
}

/**
 * RC-1 — Session Management. Everything here reads/writes
 * RefreshTokenRepository directly rather than duplicating logic already
 * in authService.ts (login/refresh/logout) — this module is the OTHER
 * half of the same entity: "let a user see and manage their own active
 * sessions," not "authenticate a request."
 */

export interface SessionSummary {
  id: string;
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  rememberMe: boolean;
  createdAt: string;
  lastUsedAt?: string;
  /** True for the exact session the caller's own current request is
   *  using — see AccessTokenPayload's own sessionId claim. */
  isCurrent: boolean;
}

function isActive(session: RefreshTokenRecord): boolean {
  return !session.revokedAt && new Date(session.expiresAt).getTime() > Date.now();
}

export const sessionService = {
  /** Every currently-active (not revoked, not expired) session for a
   *  user, newest-active first — the Active Sessions panel's own data
   *  source. Revoked/expired history rows are deliberately excluded
   *  here (Login History, backed by securityAuditLogService, is the
   *  place for history — this is "what can I log out of right now"). */
  async listActiveSessions(userId: string, currentSessionId?: string): Promise<SessionSummary[]> {
    const repository = await getRefreshTokenRepository();
    const all = await repository.listByUserId(userId);
    return all
      .filter(isActive)
      .map((session) => ({
        id: session.id,
        deviceName: session.deviceName,
        browser: session.browser,
        os: session.os,
        ipAddress: session.ipAddress,
        rememberMe: session.rememberMe,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        isCurrent: session.id === currentSessionId,
      }))
      .sort((a, b) => (b.lastUsedAt ?? b.createdAt).localeCompare(a.lastUsedAt ?? a.createdAt));
  },

  /** Revokes exactly one session — "log out this device." Ownership is
   *  verified (the session must belong to the requesting user) before
   *  revoking anything, so one user can never revoke another's session
   *  by guessing/enumerating an id. */
  async revokeSession(userId: string, sessionId: string, context: AuditContext = {}): Promise<{ success: boolean }> {
    const repository = await getRefreshTokenRepository();
    const sessions = await repository.listByUserId(userId);
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return { success: false };

    await repository.revoke(sessionId);
    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.SESSION_REVOKED,
      entityType: "User",
      entityId: userId,
      actorId: userId,
      actorType: "user",
      requestId: context.requestId,
      metadata: { sessionId, deviceName: target.deviceName },
    });
    return { success: true };
  },

  /** "Log out all OTHER devices" — revokes every active session except
   *  the caller's own current one (when known). Omitting
   *  `currentSessionId` revokes genuinely everywhere, used by
   *  password-reset/MFA-disable, which have real reason to want a
   *  clean slate. */
  async revokeAllOtherSessions(userId: string, currentSessionId: string | undefined, context: AuditContext = {}): Promise<void> {
    const repository = await getRefreshTokenRepository();
    await repository.revokeAllForUser(userId, currentSessionId);
    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.SESSIONS_REVOKED_ALL,
      entityType: "User",
      entityId: userId,
      actorId: userId,
      actorType: "user",
      requestId: context.requestId,
      metadata: { keptCurrentSession: Boolean(currentSessionId) },
    });
  },

  /** RC-5 — Backup, Restore & Disaster Recovery: the admin-on-behalf-of
   *  variant `revokeAllOtherSessions` above deliberately doesn't cover
   *  (that one only ever acts on the CALLER's own sessions). This is
   *  the real, load-bearing mechanism the "compromised tenant admin
   *  account" incident-response procedure (DR_RUNBOOK.md §12) depends
   *  on — without it, that procedure would be documentation with no
   *  actual capability behind it. Revokes EVERY refresh token for the
   *  target user, no exception (unlike the self-service version, there
   *  is no "current session" to preserve — an admin acting on someone
   *  else's account should end all of it). Tenant ownership of
   *  `targetUserId` must be verified by the CALLER before this runs —
   *  see the route's own doc comment for why (User isn't
   *  tenantScopePlugin-scoped, same as RefreshToken/Organization/
   *  ScheduledJob). */
  async adminRevokeAllSessions(targetUserId: string, context: AuditContext = {}): Promise<void> {
    const repository = await getRefreshTokenRepository();
    await repository.revokeAllForUser(targetUserId, undefined);
    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.SESSIONS_REVOKED_ALL,
      entityType: "User",
      entityId: targetUserId,
      actorId: context.actorId,
      actorType: "user",
      requestId: context.requestId,
      metadata: { triggeredBy: "admin" },
    });
  },

  /** Newest-first, capped at a reasonable page size for a UI panel —
   *  this isn't a paginated audit-log browser, it's "your last N
   *  sign-in-related events." */
  async listLoginHistory(userId: string, limit = 50): Promise<LoginHistoryEntry[]> {
    const entries = await securityAuditLogService.listForEntity("User", userId);
    return entries
      .filter((entry) => LOGIN_HISTORY_ACTIONS.includes(entry.action))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((entry) => {
        const metadata = (entry.metadata ?? {}) as Record<string, unknown>;
        return {
          id: entry.id,
          action: entry.action,
          createdAt: entry.createdAt,
          ipAddress: typeof metadata.ipAddress === "string" ? metadata.ipAddress : undefined,
          userAgent: typeof metadata.userAgent === "string" ? metadata.userAgent : undefined,
          deviceName: typeof metadata.deviceName === "string" ? metadata.deviceName : undefined,
          reason: typeof metadata.reason === "string" ? metadata.reason : undefined,
        };
      });
  },
};
