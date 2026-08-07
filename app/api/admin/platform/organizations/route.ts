import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { platformOrganizationService } from "@/lib/services/organizations";
import type { OrganizationStatus } from "@/lib/services/organizations";
import { parsePaginationParams } from "@/lib/api";

/**
 * GET /api/admin/platform/organizations
 *
 * RC-6 — Platform Super Admin & SaaS Operations Console: the platform
 * console's own organization directory — search/filter/paginate across
 * EVERY organization on the deployment. An ordinary tenant admin has no
 * legitimate reason to see this; `requiredPlatformRole` is the entire
 * enforcement (never `requiredRole`, which this route deliberately does
 * not set — see withApiRoute.ts's own doc comment on why the two gates
 * answer different questions).
 *
 * ⚠️ requiredPlatformRole: "super_admin" — also enforces MFA (see
 * withApiRoute.ts).
 */
async function handleListOrganizations(request: Request, _ctx: ApiRouteContext): Promise<NextResponse> {
  const url = new URL(request.url);
  const { page, limit } = parsePaginationParams(url.searchParams);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search") ?? undefined;

  const result = await platformOrganizationService.listOrganizations(
    { status: status === "active" || status === "suspended" ? (status as OrganizationStatus) : undefined, search },
    page,
    limit,
  );
  return apiSuccess({ result });
}

export const GET = withApiRoute("platform.organizations.list", handleListOrganizations, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
