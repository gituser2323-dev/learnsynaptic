import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { paymentService } from "@/lib/services/payments";

/**
 * GET /api/admin/payments/analytics
 *
 * Payments Integration (Phase 6), Module 6.4 — "Payment Analytics" for
 * the Admin UI's own summary cards. requiredRole: "manager", matching
 * 7.1's Pipeline Analytics precedent for revenue-sensitive data.
 */
async function handleGetAnalytics(): Promise<NextResponse> {
  const result = await paymentService.getAnalytics();
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.payments.analytics.get", handleGetAnalytics, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});
