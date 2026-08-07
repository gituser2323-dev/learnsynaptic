import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { searchPlatform } from "@/lib/services/platformAdmin";

/**
 * GET /api/admin/platform/search?q=...
 *
 * RC-6 — platform-level search limited to exactly what the mission
 * names: organization name/id, user email, subscription reference.
 * Deliberately NOT unrestricted search across customer CRM contents
 * (leads, conversations, campaigns) — see searchPlatform's own doc
 * comment.
 *
 * ⚠️ requiredPlatformRole: "super_admin".
 */
async function handleSearch(request: Request, _ctx: ApiRouteContext): Promise<NextResponse> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    throw new ValidationApiError([{ field: "q", message: "q must be at least 2 characters." }]);
  }

  const result = await searchPlatform(q);
  return apiSuccess({ result });
}

export const GET = withApiRoute("platform.search", handleSearch, {
  requiredPlatformRole: "super_admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
