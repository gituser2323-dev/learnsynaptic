import { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams, toCsv } from "@/lib/api";
import { registrationService } from "@/lib/services/registrations";
import type { RegistrationListFilters } from "@/lib/services/registrations";

/**
 * GET /api/admin/registrations
 *
 * Admin Dashboard Backend — filtered/paginated registration listing.
 * (Aggregate Registration Analytics lives at GET /api/admin/analytics.)
 *
 * ⚠️ requiredRole: "admin" — fails closed until real auth exists.
 */
async function handleListRegistrations(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filters: RegistrationListFilters = {
    status: (searchParams.get("status") as RegistrationListFilters["status"]) || undefined,
    programSlug: searchParams.get("programSlug") || undefined,
    campaignId: searchParams.get("campaignId") || undefined,
  };

  const format = searchParams.get("format");
  if (format === "csv") {
    const { items } = await registrationService.listRegistrations(filters, 1, 5000);
    const csv = toCsv(items, [
      { header: "id", value: (r) => r.id },
      { header: "leadId", value: (r) => r.leadId },
      { header: "programSlug", value: (r) => r.programSlug },
      { header: "status", value: (r) => r.status },
      { header: "source", value: (r) => r.source },
      { header: "campaignId", value: (r) => r.campaignId },
      { header: "createdAt", value: (r) => r.createdAt },
    ]);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=registrations.csv",
      },
    });
  }

  const { page, limit } = parsePaginationParams(searchParams);
  const result = await registrationService.listRegistrations(filters, page, limit);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.registrations.list", handleListRegistrations, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
