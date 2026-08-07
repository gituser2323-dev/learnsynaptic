import { describe, it, expect, vi, afterEach } from "vitest";
import { invitationService } from "./invitationService";
import { onboardingService } from "./onboardingService";
import { authService } from "@/lib/services/auth";
import { subscriptionService, TRIAL_PLAN_ID } from "@/lib/services/billing";
import { getUserRepository, getTeamInvitationRepository } from "@/lib/db";

vi.mock("@/lib/services/auth/authEmails", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/auth/authEmails")>();
  return { ...actual, sendTeamInvitationEmail: vi.fn(actual.sendTeamInvitationEmail) };
});

import { sendTeamInvitationEmail } from "@/lib/services/auth/authEmails";

let counter = 0;
function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${counter}@rc7-invitation-test.local`;
}

async function makeOrgWithAdmin(label: string) {
  const email = uniqueEmail(label);
  const registerResult = await authService.registerUser({ email, name: "Org Admin", password: "StrongPass123", termsAccepted: true });
  if (!registerResult.success) throw new Error(JSON.stringify(registerResult.errors));
  const userRepository = await getUserRepository();
  await userRepository.update(registerResult.user.id, { emailVerifiedAt: new Date().toISOString() });
  const orgResult = await onboardingService.createOrganizationForUser(registerResult.user.id, { name: `${label} Org` });
  if (!orgResult.success) throw new Error(JSON.stringify(orgResult.errors));
  return { adminUserId: registerResult.user.id, organizationId: orgResult.organization.id };
}

function extractRawToken(mockFn: ReturnType<typeof vi.fn>): string {
  const call = mockFn.mock.calls.at(-1);
  if (!call) throw new Error("expected sendTeamInvitationEmail to have been called");
  return call[1] as string;
}

describe("invitationService.sendInvitation — RC-7", () => {
  afterEach(() => vi.clearAllMocks());

  it("sends a real invitation and a real email", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("send-happy");
    const email = uniqueEmail("invitee");
    const result = await invitationService.sendInvitation(organizationId, adminUserId, { email, role: "counsellor" }, "Acme Inc", "Admin", {});
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.invitation.status).toBe("pending");
    expect(sendTeamInvitationEmail).toHaveBeenCalledWith(email, expect.any(String), "Acme Inc", "Admin");
  });

  it("rejects an invalid email/role", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("send-invalid");
    const result = await invitationService.sendInvitation(organizationId, adminUserId, { email: "not-an-email", role: "wizard" }, "Org", "Admin", {});
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "email")).toBe(true);
    expect(result.errors.some((e) => e.field === "role")).toBe(true);
  });

  it("refuses to invite an email that already has a real account", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("send-existing");
    const existingEmail = uniqueEmail("already-exists");
    const registerResult = await authService.registerUser({ email: existingEmail, name: "X", password: "StrongPass123", termsAccepted: true });
    expect(registerResult.success).toBe(true);

    const result = await invitationService.sendInvitation(organizationId, adminUserId, { email: existingEmail, role: "counsellor" }, "Org", "Admin", {});
    expect(result.success).toBe(false);
  });

  it("a second invite to the same pending email resends (refreshes token/expiry) instead of creating a duplicate row", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("send-dup");
    const email = uniqueEmail("dup-invitee");
    const first = await invitationService.sendInvitation(organizationId, adminUserId, { email, role: "counsellor" }, "Org", "Admin", {});
    expect(first.success).toBe(true);
    if (!first.success) return;

    const second = await invitationService.sendInvitation(organizationId, adminUserId, { email, role: "manager" }, "Org", "Admin", {});
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.invitation.id).toBe(first.invitation.id);

    const invitationRepository = await getTeamInvitationRepository();
    const all = await invitationRepository.listByOrganization(organizationId, 1, 50);
    expect(all.items.filter((i) => i.email === email.toLowerCase())).toHaveLength(1);
  });

  it("server-side seat-limit enforcement — refuses an invite once active users + pending invites reach the plan's seat limit", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("send-seat-limit");
    await onboardingService.listSelectablePlans(); // ensures the trial plan is seeded
    const assignResult = await subscriptionService.assignPlan(organizationId, TRIAL_PLAN_ID);
    expect(assignResult.planId).toBe(TRIAL_PLAN_ID);

    // Trial plan seat limit is 3; the admin themself occupies 1 seat.
    const inviteA = await invitationService.sendInvitation(organizationId, adminUserId, { email: uniqueEmail("seat-a"), role: "counsellor" }, "Org", "Admin", {});
    const inviteB = await invitationService.sendInvitation(organizationId, adminUserId, { email: uniqueEmail("seat-b"), role: "counsellor" }, "Org", "Admin", {});
    expect(inviteA.success).toBe(true);
    expect(inviteB.success).toBe(true);

    // 1 admin + 2 pending invites = 3 seats claimed; a 4th must be refused.
    const inviteC = await invitationService.sendInvitation(organizationId, adminUserId, { email: uniqueEmail("seat-c"), role: "counsellor" }, "Org", "Admin", {});
    expect(inviteC.success).toBe(false);
    if (inviteC.success) return;
    expect(inviteC.errors[0].message).toMatch(/plan allows/i);
  });
});

describe("invitationService.revokeInvitation — RC-7", () => {
  it("revokes a pending invitation, and its token stops working", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("revoke");
    const email = uniqueEmail("revoke-invitee");
    const sendResult = await invitationService.sendInvitation(organizationId, adminUserId, { email, role: "counsellor" }, "Org", "Admin", {});
    expect(sendResult.success).toBe(true);
    if (!sendResult.success) return;

    const rawToken = extractRawToken(sendTeamInvitationEmail as unknown as ReturnType<typeof vi.fn>);
    const revoked = await invitationService.revokeInvitation(organizationId, sendResult.invitation.id, { actorId: adminUserId });
    expect(revoked.status).toBe("revoked");

    const acceptResult = await invitationService.acceptInvitation(rawToken, { name: "Invitee", password: "StrongPass123" });
    expect(acceptResult.success).toBe(false);
    if (acceptResult.success) return;
    expect(acceptResult.errors[0].message).toMatch(/revoked/i);
  });

  it("throws for a cross-tenant revoke attempt (wrong organizationId)", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("revoke-cross-a");
    const { organizationId: otherOrgId } = await makeOrgWithAdmin("revoke-cross-b");
    const sendResult = await invitationService.sendInvitation(organizationId, adminUserId, { email: uniqueEmail("cross"), role: "counsellor" }, "Org", "Admin", {});
    expect(sendResult.success).toBe(true);
    if (!sendResult.success) return;

    await expect(invitationService.revokeInvitation(otherOrgId, sendResult.invitation.id, {})).rejects.toThrow();
  });
});

describe("invitationService.acceptInvitation — RC-7 pentest: real cross-tenant + abuse scenarios", () => {
  afterEach(() => vi.clearAllMocks());

  it("accepts a real, pending invitation and creates a real, already-verified account in the RIGHT organization with the RIGHT role", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("accept-happy");
    const email = uniqueEmail("accept-invitee");
    const sendResult = await invitationService.sendInvitation(organizationId, adminUserId, { email, role: "manager" }, "Org", "Admin", {});
    expect(sendResult.success).toBe(true);
    if (!sendResult.success) return;
    const rawToken = extractRawToken(sendTeamInvitationEmail as unknown as ReturnType<typeof vi.fn>);

    const acceptResult = await invitationService.acceptInvitation(rawToken, { name: "New Teammate", password: "StrongPass123" });
    expect(acceptResult.success).toBe(true);
    if (!acceptResult.success) return;
    expect(acceptResult.user.role).toBe("manager");
    expect(acceptResult.user.emailVerified).toBe(true);
    expect(acceptResult.tokens.accessToken).toBeTruthy();

    const userRepository = await getUserRepository();
    const stored = await userRepository.findById(acceptResult.user.id);
    expect(stored?.organizationId).toBe(organizationId);
  });

  it("pentest — a garbage/forged token is rejected, never treated as valid", async () => {
    const result = await invitationService.acceptInvitation("totally-forged-token-value", { name: "X", password: "StrongPass123" });
    expect(result.success).toBe(false);
  });

  it("an already-accepted invitation cannot be redeemed a second time — no duplicate account, no token reuse", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("accept-replay");
    const email = uniqueEmail("replay-invitee");
    const sendResult = await invitationService.sendInvitation(organizationId, adminUserId, { email, role: "counsellor" }, "Org", "Admin", {});
    expect(sendResult.success).toBe(true);
    if (!sendResult.success) return;
    const rawToken = extractRawToken(sendTeamInvitationEmail as unknown as ReturnType<typeof vi.fn>);

    const first = await invitationService.acceptInvitation(rawToken, { name: "First", password: "StrongPass123" });
    expect(first.success).toBe(true);

    const replay = await invitationService.acceptInvitation(rawToken, { name: "Replay", password: "StrongPass123" });
    expect(replay.success).toBe(false);
    if (replay.success) return;
    expect(replay.errors[0].message).toMatch(/already been used/i);
  });

  it("an expired invitation is rejected and marked expired, not silently accepted", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("accept-expired");
    const email = uniqueEmail("expired-invitee");
    const sendResult = await invitationService.sendInvitation(organizationId, adminUserId, { email, role: "counsellor" }, "Org", "Admin", {});
    expect(sendResult.success).toBe(true);
    if (!sendResult.success) return;
    const rawToken = extractRawToken(sendTeamInvitationEmail as unknown as ReturnType<typeof vi.fn>);

    const invitationRepository = await getTeamInvitationRepository();
    await invitationRepository.update(sendResult.invitation.id, { expiresAt: new Date(Date.now() - 1000).toISOString() });

    const result = await invitationService.acceptInvitation(rawToken, { name: "Too Late", password: "StrongPass123" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].message).toMatch(/expired/i);
  });

  it("rejects acceptance if the invited email gained a real account in the meantime (race condition)", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("accept-race");
    const email = uniqueEmail("race-invitee");
    const sendResult = await invitationService.sendInvitation(organizationId, adminUserId, { email, role: "counsellor" }, "Org", "Admin", {});
    expect(sendResult.success).toBe(true);
    if (!sendResult.success) return;
    const rawToken = extractRawToken(sendTeamInvitationEmail as unknown as ReturnType<typeof vi.fn>);

    const raceRegister = await authService.registerUser({ email, name: "Raced", password: "StrongPass123", termsAccepted: true });
    expect(raceRegister.success).toBe(true);

    const result = await invitationService.acceptInvitation(rawToken, { name: "Too Slow", password: "StrongPass123" });
    expect(result.success).toBe(false);
  });

  it("rejects a weak password at acceptance time — the same real strength bar as self-registration, not a lighter one", async () => {
    const { adminUserId, organizationId } = await makeOrgWithAdmin("accept-weak-password");
    const email = uniqueEmail("weak-password-invitee");
    const sendResult = await invitationService.sendInvitation(organizationId, adminUserId, { email, role: "counsellor" }, "Org", "Admin", {});
    expect(sendResult.success).toBe(true);
    if (!sendResult.success) return;
    const rawToken = extractRawToken(sendTeamInvitationEmail as unknown as ReturnType<typeof vi.fn>);

    const result = await invitationService.acceptInvitation(rawToken, { name: "Weak", password: "alllowercase" });
    expect(result.success).toBe(false);
  });
});
