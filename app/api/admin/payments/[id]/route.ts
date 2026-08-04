import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { paymentService } from "@/lib/services/payments";

/**
 * GET /api/admin/payments/[id]
 *
 * Payments Integration (Phase 6), Module 6.4 — one transaction's full
 * detail (status, provider, CRM linkage, refund total).
 */
async function handleGetPayment(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const payment = await paymentService.getPayment(id);
  if (!payment) throw new NotFoundApiError("Payment", id);
  return apiSuccess({ payment });
}

export const GET = withApiRoute("admin.payments.get", handleGetPayment, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
