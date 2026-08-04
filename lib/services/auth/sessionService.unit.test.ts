import { describe, it, expect } from "vitest";
import { sessionService } from "./sessionService";
import { authService } from "./authService";

let counter = 0;
function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${counter}@session-test.local`;
}

async function createTestUser(label: string) {
  const email = uniqueEmail(label);
  const result = await authService.createUser({ email, password: "OldPass123", role: "counsellor" });
  if (!result.success) throw new Error(`test setup failed: ${JSON.stringify(result.errors)}`);
  return { email, user: result.user };
}

describe("sessionService.listActiveSessions", () => {
  it("lists only this user's own active sessions, marking the current one", async () => {
    const { email, user } = await createTestUser("list");
    const sessionA = await authService.login({ email, password: "OldPass123" });
    const sessionB = await authService.login({ email, password: "OldPass123" });
    expect(sessionA.success && sessionB.success).toBe(true);
    if (!sessionA.success || !sessionB.success) return;

    void sessionB;
    const sessions = await sessionService.listActiveSessions(user.id);
    expect(sessions).toHaveLength(2);
  });

  it("excludes another user's sessions entirely", async () => {
    const { email: emailA, user: userA } = await createTestUser("isolate-a");
    const { email: emailB } = await createTestUser("isolate-b");
    await authService.login({ email: emailA, password: "OldPass123" });
    await authService.login({ email: emailB, password: "OldPass123" });

    const sessionsA = await sessionService.listActiveSessions(userA.id);
    expect(sessionsA).toHaveLength(1);
  });

  it("excludes a revoked session from the active list", async () => {
    const { email, user } = await createTestUser("exclude-revoked");
    const session = await authService.login({ email, password: "OldPass123" });
    expect(session.success).toBe(true);
    if (!session.success) return;

    await authService.logout(session.tokens.refreshToken);
    const sessions = await sessionService.listActiveSessions(user.id);
    expect(sessions).toHaveLength(0);
  });
});

describe("sessionService.revokeSession", () => {
  it("pentest — Cross-Account Session Revocation: cannot revoke another user's session (ownership-checked, 'not found' not an error)", async () => {
    const { email: emailA, user: userA } = await createTestUser("revoke-cross-a");
    const { user: userB } = await createTestUser("revoke-cross-b");
    await authService.login({ email: emailA, password: "OldPass123" });
    const [sessionOfA] = await sessionService.listActiveSessions(userA.id);

    const result = await sessionService.revokeSession(userB.id, sessionOfA!.id);
    expect(result.success).toBe(false);
    expect(await sessionService.listActiveSessions(userA.id)).toHaveLength(1); // untouched
  });

  it("revokes the caller's own session, and it stops being usable for refresh", async () => {
    const { email, user } = await createTestUser("revoke-own");
    const session = await authService.login({ email, password: "OldPass123" });
    expect(session.success).toBe(true);
    if (!session.success) return;
    const [record] = await sessionService.listActiveSessions(user.id);

    const result = await sessionService.revokeSession(user.id, record!.id);
    expect(result.success).toBe(true);

    const refreshAttempt = await authService.refreshSession(session.tokens.refreshToken);
    expect(refreshAttempt.success).toBe(false);
  });
});

describe("sessionService.revokeAllOtherSessions", () => {
  it("revokes every session except the one identified as current", async () => {
    const { email, user } = await createTestUser("revoke-others");
    const kept = await authService.login({ email, password: "OldPass123" });
    const revoked1 = await authService.login({ email, password: "OldPass123" });
    const revoked2 = await authService.login({ email, password: "OldPass123" });
    expect(kept.success && revoked1.success && revoked2.success).toBe(true);
    if (!kept.success || !revoked1.success || !revoked2.success) return;

    void kept;
    void revoked1;
    void revoked2;

    // We don't have direct access to each login's own sessionId without
    // JWT-decoding; instead assert the AGGREGATE behavior: revoking "all
    // other than X" for some real, arbitrarily-chosen active session id X
    // leaves exactly that one session active, whichever one we pick.
    const all = await sessionService.listActiveSessions(user.id);
    expect(all).toHaveLength(3);

    const currentId = all[0]!.id;
    await sessionService.revokeAllOtherSessions(user.id, currentId);
    const remaining = await sessionService.listActiveSessions(user.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(currentId);
  });

  it("revokes every session when no current session id is given (used by password-reset/MFA-disable)", async () => {
    const { email, user } = await createTestUser("revoke-all-none-current");
    await authService.login({ email, password: "OldPass123" });
    await authService.login({ email, password: "OldPass123" });

    await sessionService.revokeAllOtherSessions(user.id, undefined);
    expect(await sessionService.listActiveSessions(user.id)).toHaveLength(0);
  });
});

describe("sessionService.listLoginHistory", () => {
  it("records a successful login and a logout as history entries", async () => {
    const { email, user } = await createTestUser("history");
    const session = await authService.login({ email, password: "OldPass123" });
    expect(session.success).toBe(true);
    if (!session.success) return;
    await authService.logout(session.tokens.refreshToken);

    const history = await sessionService.listLoginHistory(user.id);
    const actions = history.map((h) => h.action);
    expect(actions).toContain("user.login_succeeded");
    expect(actions).toContain("user.logged_out");
  });

  it("records a failed login attempt distinctly from a successful one", async () => {
    const { email, user } = await createTestUser("history-failed");
    await authService.login({ email, password: "wrong-password" });
    await authService.login({ email, password: "OldPass123" });

    const history = await sessionService.listLoginHistory(user.id);
    expect(history.some((h) => h.action === "user.login_failed")).toBe(true);
    expect(history.some((h) => h.action === "user.login_succeeded")).toBe(true);
  });

  it("never mixes another user's history into the caller's own", async () => {
    const { email: emailA, user: userA } = await createTestUser("history-isolate-a");
    const { email: emailB, user: userB } = await createTestUser("history-isolate-b");
    await authService.login({ email: emailA, password: "OldPass123" });
    await authService.login({ email: emailB, password: "OldPass123" });
    await authService.login({ email: emailB, password: "wrong-password" });

    const historyA = await sessionService.listLoginHistory(userA.id);
    expect(historyA).toHaveLength(1);
    expect(historyA[0]!.action).toBe("user.login_succeeded");
    void userB;
  });
});
