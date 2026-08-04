import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { paymentService, PaymentNotFoundError, PaymentProviderError } from "@/lib/services/payments";

/**
 * POST /api/admin/payments/[id]/retry
 *
 * Payments Integration (Phase 6), Module 6.4 — "Retry Handling" for a
 * failed payment: creates a genuinely new Payment + checkout session
 * (see paymentService.retryPayment's own doc comment on why a retry
 * can never resurrect the original order in place). `returnUrl` is
 * required — the original attempt's own return URL isn't persisted
 * separately from its checkoutUrl, so the caller supplies where the
 * customer should land after this new attempt.
 */
async function handleRetryPayment(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = await request.json().catch(() => null);
  const returnUrl = typeof (body as Record<string, unknown> | null)?.returnUrl === "string" ? ((body as Record<string, unknown>).returnUrl as string) : "";
  if (!returnUrl) throw new ValidationApiError([{ field: "returnUrl", message: "returnUrl is required." }]);

  try {
    const result = await paymentService.retryPayment(id, returnUrl, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
    if (!result.success) throw new ValidationApiError(result.errors);
    return apiSuccess({ payment: result.payment }, 201);
  } catch (error) {
    if (error instanceof PaymentNotFoundError) throw new NotFoundApiError("Payment", id);
    if (error instanceof PaymentProviderError) throw new ValidationApiError([{ field: "root", message: error.message }]);
    throw error;
  }
}

export const POST = withApiRoute("admin.payments.retry", handleRetryPayment, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});
