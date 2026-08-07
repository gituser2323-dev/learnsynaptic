import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, UnauthorizedApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { invitationService } from "@/lib/services/onboarding";
import { getOrganizationRepository, getUserRepository } from "@/lib/db";

/**
 * GET/POST /api/admin/team/invitations
 *
 * RC-7 — Customer Onboarding & SaaS Activation. The TEAM step's own
 * write surface (mission §12/§13). `requiredRole: "admin"` — inviting
 * a new team member (and choosing their role) is an organization-wide
 * decision, the same tier `authService.createUser()`'s own seat-gated
 * provisioning has always implicitly required (only ever reachable via
 * an operator with shell access before this pass).
 */
async function handleListInvitations(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.organizationId) throw new UnauthorizedApiError();
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;
  const result = await invitationService.listInvitations(ctx.authContext.organizationId, page, limit);
  return apiSuccess({ ...result });
}

async function handleSendInvitation(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  if (!ctx.authContext.organizationId || !ctx.authContext.userId) throw new UnauthorizedApiError();

  const [organization, inviter] = await Promise.all([
    (await getOrganizationRepository()).findById(ctx.authContext.organizationId),
    (await getUserRepository()).findById(ctx.authContext.userId),
  ]);

  const body = await parseJsonBody(request);
  const result = await invitationService.sendInvitation(
    ctx.authContext.organizationId,
    ctx.authContext.userId,
    body,
    organization?.name ?? "your workspace",
    inviter?.name ?? "A teammate",
    { requestId: ctx.requestId },
  );

  if (!result.success) throw new ValidationApiError(result.errors);
  return apiSuccess({ invitation: result.invitation }, 201);
}

export const GET = withApiRoute("admin.team.invitations.list", handleListInvitations, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.team.invitations.create", handleSendInvitation, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60 * 60_000 },
});
