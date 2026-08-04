import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { paymentService, PaymentNotFoundError, PaymentProviderError } from "@/lib/services/payments";

/**
 * POST /api/admin/payments/[id]/refund
 *
 * Payments Integration (Phase 6), Module 6.4 — "Refund Support."
 * `amountInSmallestUnit` is optional — omitted means a full refund of
 * whatever remains unrefunded, the same "omit for the obvious default"
 * shape this app's own APIs already use elsewhere. A partial refund is
 * a real, valid request: `status` lands on "partially_refunded" rather
 * than "refunded" when the refunded total is still short of the
 * original amount (see paymentService.refundPayment's own logic).
 */
async function handleRefundPayment(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = await request.json().catch(() => ({}));
  const amountRaw = (body as Record<string, unknown> | null)?.amountInSmallestUnit;
  const amountInSmallestUnit = typeof amountRaw === "number" && Number.isInteger(amountRaw) && amountRaw > 0 ? amountRaw : undefined;
  const reason = typeof (body as Record<string, unknown> | null)?.reason === "string" ? ((body as Record<string, unknown>).reason as string) : undefined;

  try {
    const payment = await paymentService.refundPayment(id, amountInSmallestUnit, reason, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
    return apiSuccess({ payment });
  } catch (error) {
    if (error instanceof PaymentNotFoundError) throw new NotFoundApiError("Payment", id);
    if (error instanceof PaymentProviderError) throw new ValidationApiError([{ field: "root", message: error.message }]);
    throw error;
  }
}

export const POST = withApiRoute("admin.payments.refund", handleRefundPayment, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});
