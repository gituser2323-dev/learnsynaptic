import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { paymentService, PaymentNotFoundError } from "@/lib/services/payments";

/**
 * POST /api/admin/payments/[id]/check-status
 *
 * Payments Integration (Phase 6), Module 6.4 — "Payment Verification" /
 * "Payment Status": a real, immediate, synchronous query against the
 * provider's own API, the manual counterpart to the scheduler's own
 * background reconciliation job (schedulerIntegration.ts). Never
 * trusts a client-supplied status — always re-derives it from the
 * vendor.
 */
async function handleCheckStatus(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  try {
    const payment = await paymentService.checkStatus(id);
    return apiSuccess({ payment });
  } catch (error) {
    if (error instanceof PaymentNotFoundError) throw new NotFoundApiError("Payment", id);
    throw error;
  }
}

export const POST = withApiRoute("admin.payments.checkStatus", handleCheckStatus, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});
