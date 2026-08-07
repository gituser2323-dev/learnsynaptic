import type { PaginatedResult } from "@/lib/pagination";
import type { UserRole } from "@/lib/services/auth";

/**
 * RC-7 — Customer Onboarding & SaaS Activation. Team invitations: this
 * codebase's ONLY path for a second person to ever join an
 * organization (see RC_7_AUDIT.md's own architecture-audit finding —
 * before this pass, every additional team member required an operator
 * running scripts/createAdminUser.ts by hand). Real, tenant-scoped
 * (`teamInvitation.model.ts` carries `tenantScopePlugin`, unlike
 * `Organization`/`User` themselves — an invitation genuinely belongs
 * to exactly one organization the same way a Lead or Task does), with
 * the one deliberate exception that accepting one happens BEFORE the
 * recipient has any session/tenant context at all — see
 * invitationService.acceptInvitation()'s own doc comment for why
 * `findByTokenHash` is looked up outside `runWithTenantContext`
 * (tenantScopePlugin.ts's own doc comment: no active context makes
 * every scoping hook a no-op, the same accepted shape
 * email-verification/password-reset token lookups already use).
 */
export type TeamInvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface TeamInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  status: TeamInvitationStatus;
  invitedByUserId: string;
  /** Never the raw token — same "only the hash is ever persisted"
   *  discipline every other token-shaped entity in this app already
   *  follows (RefreshToken, PasswordResetToken, EmailVerificationToken). */
  tokenHash: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedByUserId?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamInvitationInput {
  organizationId: string;
  email: string;
  role: UserRole;
  invitedByUserId: string;
  tokenHash: string;
  expiresAt: string;
}

export interface UpdateTeamInvitationInput {
  status?: TeamInvitationStatus;
  tokenHash?: string;
  expiresAt?: string;
  acceptedAt?: string;
  acceptedByUserId?: string;
  revokedAt?: string;
}

export interface TeamInvitationRepository {
  findById(id: string): Promise<TeamInvitation | null>;
  /** Deliberately not tenant-scoped in practice — called from
   *  invitationService.acceptInvitation(), which runs before the
   *  caller has any tenant context at all (see this file's own module
   *  doc). The token's own unguessable randomness is what makes this
   *  safe, the identical shape every other opaque-token lookup in this
   *  app already relies on. */
  findByTokenHash(tokenHash: string): Promise<TeamInvitation | null>;
  /** Used to refuse a duplicate invite to the same email while a real
   *  pending one already exists — resend the existing one instead. */
  findPendingByOrganizationAndEmail(organizationId: string, email: string): Promise<TeamInvitation | null>;
  create(input: CreateTeamInvitationInput): Promise<TeamInvitation>;
  /** Throws if `id` doesn't resolve to a real invitation (mirrors every
   *  other entity's own update() contract in this codebase). */
  update(id: string, patch: UpdateTeamInvitationInput): Promise<TeamInvitation>;
  listByOrganization(organizationId: string, page: number, limit: number): Promise<PaginatedResult<TeamInvitation>>;
  /** The real, live seat-limit check onboardingService/invitationService
   *  needs BEFORE sending a new invite — active users alone
   *  undercounts real seat pressure (mission §14's own "do not allow
   *  invitations that EXCEED tenant seat entitlement" — a pending
   *  invitation is a real, not-yet-realized claim on a seat). */
  countPendingByOrganization(organizationId: string): Promise<number>;
}
