import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { leadService } from "@/lib/services/leads";
import { registrationService } from "@/lib/services/registrations";
import { getStudentStatusSummary } from "@/lib/services/adminAnalytics";

/**
 * GET /api/admin/analytics
 *
 * Admin Dashboard Backend — Registration Analytics, UTM Analytics, and
 * Student Status in one payload. Consolidated into a single route rather
 * than three (`/analytics/utm`, `/analytics/registrations`,
 * `/analytics/student-status`) since a dashboard would fetch all three
 * together anyway, and each is still a distinct, independently-callable
 * service method underneath — this route is a thin composition, not
 * where the logic lives.
 *
 * ⚠️ requiredRole: "admin" — fails closed until real auth exists.
 */
async function handleGetAnalytics(): Promise<NextResponse> {
  const [registrations, utm, studentStatus] = await Promise.all([
    registrationService.getAnalytics(),
    leadService.getUtmAnalytics(),
    getStudentStatusSummary(),
  ]);

  return apiSuccess({ registrations, utm, studentStatus });
}

export const GET = withApiRoute("admin.analytics.get", handleGetAnalytics, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
