import { getTeamInvitationRepository, getUserRepository, getOrganizationRepository } from "@/lib/db";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/services/auth/opaqueToken";
import { sendTeamInvitationEmail } from "@/lib/services/auth/authEmails";
import { authService } from "@/lib/services/auth";
import type { UserRole, AuthValidationError, AuthTokens, PublicUser } from "@/lib/services/auth";
import { entitlementService } from "@/lib/services/billing";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { TEAM_INVITATION_TTL_SECONDS } from "@/config/auth";
import type { TeamInvitation } from "./invitationTypes";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: UserRole[] = ["counsellor", "manager", "admin"];

export interface InvitationValidationError {
  field: string;
  message: string;
}

export type SendInvitationResult =
  | { success: true; invitation: TeamInvitation }
  | { success: false; errors: InvitationValidationError[] };

async function seatsAvailable(organizationId: string): Promise<{ available: boolean; limit: number | null }> {
  const limit = await entitlementService.getLimit(organizationId, "seats");
  if (limit === null) return { available: true, limit: null };

  const userRepository = await getUserRepository();
  const invitationRepository = await getTeamInvitationRepository();
  const [activeUsers, pendingInvites] = await Promise.all([
    userRepository.listActive(),
    invitationRepository.countPendingByOrganization(organizationId),
  ]);
  const activeSeats = activeUsers.filter((u) => u.organizationId === organizationId).length;
  return { available: activeSeats + pendingInvites < limit, limit };
}

function newExpiry(): string {
  return new Date(Date.now() + TEAM_INVITATION_TTL_SECONDS * 1000).toISOString();
}

/**
 * RC-7 — Customer Onboarding & SaaS Activation. The TEAM step's own
 * write side (mission §12/§13/§14): secure, expiring, single-use,
 * server-side-seat-limit-enforced invitations — this codebase's only
 * path for a second person to ever join an organization, replacing the
 * previous "an operator runs scripts/createAdminUser.ts by hand for
 * every new team member" reality (see RC_7_AUDIT.md's own architecture
 * audit finding).
 */
export const invitationService = {
  /**
   * Reuses `entitlementService.getLimit(organizationId, "seats")` — the
   * exact same limit `authService.createUser()`'s own seat check
   * already enforces for CLI-provisioned accounts — counted against
   * active users PLUS pending invitations (mission §14's own "do not
   * allow invitations that EXCEED tenant seat entitlement" — a pending
   * invite is a real claim on a seat, not yet realized, but still real
   * enough to block a further invite past the limit). Re-sending to an
   * email with a real pending invite already outstanding refreshes
   * that SAME invitation (new token, new expiry) rather than creating
   * a second row — mission §41's own idempotency requirement.
   * Refuses to invite an email that already has a real account
   * anywhere on this deployment — this app's own one-organization-
   * per-user architecture has no way to honor a second membership.
   */
  async sendInvitation(
    organizationId: string,
    invitedByUserId: string,
    input: unknown,
    organizationName: string,
    inviterName: string,
    context: AuditContext = {},
  ): Promise<SendInvitationResult> {
    if (typeof input !== "object" || input === null) {
      return { success: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
    }
    const record = input as Record<string, unknown>;
    const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
    const role = typeof record.role === "string" ? (record.role as UserRole) : undefined;

    const errors: InvitationValidationError[] = [];
    if (!email) errors.push({ field: "email", message: "Email is required." });
    else if (!EMAIL_RE.test(email)) errors.push({ field: "email", message: "Email must be a valid address." });
    if (!role) errors.push({ field: "role", message: "Role is required." });
    else if (!ROLES.includes(role)) errors.push({ field: "role", message: `Role must be one of: ${ROLES.join(", ")}.` });
    if (errors.length > 0) return { success: false, errors };

    const userRepository = await getUserRepository();
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      return { success: false, errors: [{ field: "email", message: "This email already has an account on this deployment." }] };
    }

    const invitationRepository = await getTeamInvitationRepository();
    const existingPending = await invitationRepository.findPendingByOrganizationAndEmail(organizationId, email);
    if (existingPending) {
      return this.resendInvitation(organizationId, existingPending.id, context);
    }

    const { available, limit } = await seatsAvailable(organizationId);
    if (!available) {
      return {
        success: false,
        errors: [{ field: "root", message: `Your plan allows ${limit} team member${limit === 1 ? "" : "s"}. Upgrade your plan to invite more.` }],
      };
    }

    const rawToken = generateOpaqueToken();
    const invitation = await invitationRepository.create({
      organizationId,
      email,
      role: role as UserRole,
      invitedByUserId,
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt: newExpiry(),
    });

    void sendTeamInvitationEmail(email, rawToken, organizationName, inviterName);

    await auditLogService.record({
      action: AUDIT_ACTIONS.TEAM_INVITATION_SENT,
      entityType: "TeamInvitation",
      entityId: invitation.id,
      actorId: invitedByUserId,
      requestId: context.requestId,
      metadata: { email, role },
    });

    return { success: true, invitation };
  },

  /** Invalidates the previous token entirely (a stale copy of the old
   *  email — forwarded, or sitting in an inbox — must stop working the
   *  moment a new one is issued), same "invalidate then reissue"
   *  discipline `authService.requestEmailVerification()` already
   *  established for its own token type. */
  async resendInvitation(organizationId: string, invitationId: string, context: AuditContext = {}): Promise<SendInvitationResult> {
    const invitationRepository = await getTeamInvitationRepository();
    const invitation = await invitationRepository.findById(invitationId);
    if (!invitation || invitation.organizationId !== organizationId) {
      return { success: false, errors: [{ field: "root", message: "Invitation not found." }] };
    }
    if (invitation.status !== "pending") {
      return { success: false, errors: [{ field: "root", message: `This invitation is ${invitation.status} and can't be resent.` }] };
    }

    const rawToken = generateOpaqueToken();
    const updated = await invitationRepository.update(invitationId, {
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt: newExpiry(),
    });

    const orgRepository = await getOrganizationRepository();
    const organization = await orgRepository.findById(organizationId);
    const inviter = await (await getUserRepository()).findById(invitation.invitedByUserId);
    void sendTeamInvitationEmail(invitation.email, rawToken, organization?.name ?? "your workspace", inviter?.name ?? "A teammate");

    await auditLogService.record({
      action: AUDIT_ACTIONS.TEAM_INVITATION_RESENT,
      entityType: "TeamInvitation",
      entityId: invitation.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { email: invitation.email },
    });

    return { success: true, invitation: updated };
  },

  async revokeInvitation(organizationId: string, invitationId: string, context: AuditContext = {}): Promise<TeamInvitation> {
    const invitationRepository = await getTeamInvitationRepository();
    const invitation = await invitationRepository.findById(invitationId);
    if (!invitation || invitation.organizationId !== organizationId) {
      throw new Error("Invitation not found.");
    }
    const updated = await invitationRepository.update(invitationId, { status: "revoked", revokedAt: new Date().toISOString() });

    await auditLogService.record({
      action: AUDIT_ACTIONS.TEAM_INVITATION_REVOKED,
      entityType: "TeamInvitation",
      entityId: invitation.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { email: invitation.email },
    });

    return updated;
  },

  async listInvitations(organizationId: string, page: number, limit: number) {
    const invitationRepository = await getTeamInvitationRepository();
    return invitationRepository.listByOrganization(organizationId, page, limit);
  },

  /**
   * RC-7 — the accept side. Runs BEFORE the recipient has any session
   * or tenant context at all (see invitationTypes.ts's own module doc
   * for why `findByTokenHash` is a deliberately un-tenant-scoped
   * lookup — the token's own unguessable randomness is the real
   * boundary here, the identical shape email-verification/password-
   * reset token lookups already use). Re-checks BOTH the seat limit
   * and the "does this email already have an account" condition again
   * at accept time, not just at send time — either could have changed
   * in the window between an invite being sent and actually accepted
   * (mission's own "server-side enforcement is mandatory" instruction,
   * §14, taken literally: enforced at the moment the seat is actually
   * claimed, not only when it was first offered).
   */
  async acceptInvitation(
    rawToken: string,
    input: unknown,
    context: AuditContext = {},
  ): Promise<
    | { success: true; user: PublicUser; tokens: AuthTokens }
    | { success: false; errors: (AuthValidationError | InvitationValidationError)[] }
  > {
    const invitationRepository = await getTeamInvitationRepository();
    const invitation = await invitationRepository.findByTokenHash(hashOpaqueToken(rawToken));
    if (!invitation) {
      return { success: false, errors: [{ field: "token", message: "This invitation link is invalid." }] };
    }
    if (invitation.status === "accepted") {
      return { success: false, errors: [{ field: "token", message: "This invitation has already been used." }] };
    }
    if (invitation.status === "revoked") {
      return { success: false, errors: [{ field: "token", message: "This invitation has been revoked." }] };
    }
    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      await invitationRepository.update(invitation.id, { status: "expired" });
      return { success: false, errors: [{ field: "token", message: "This invitation link has expired. Ask your admin to resend it." }] };
    }

    const userRepository = await getUserRepository();
    const existingUser = await userRepository.findByEmail(invitation.email);
    if (existingUser) {
      return { success: false, errors: [{ field: "root", message: "An account with this email already exists." }] };
    }

    const { available, limit } = await seatsAvailable(invitation.organizationId);
    if (!available) {
      return {
        success: false,
        errors: [{ field: "root", message: `This organization's plan allows ${limit} team member${limit === 1 ? "" : "s"} and is now full. Ask your admin to upgrade.` }],
      };
    }

    const result = await authService.createUserFromInvitation(invitation.email, invitation.organizationId, invitation.role, input, context);
    if (!result.success) return result;

    await invitationRepository.update(invitation.id, {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
      acceptedByUserId: result.user.id,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.TEAM_INVITATION_ACCEPTED,
      entityType: "TeamInvitation",
      entityId: invitation.id,
      actorId: result.user.id,
      requestId: context.requestId,
      metadata: { email: invitation.email },
    });

    return result;
  },
};
