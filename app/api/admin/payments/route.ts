import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, ValidationApiError, parsePaginationParams } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { paymentService } from "@/lib/services/payments";
import type { PaymentProviderId, PaymentStatus } from "@/lib/services/payments";

const PAYMENT_STATUSES: PaymentStatus[] = ["created", "pending", "succeeded", "failed", "refunded", "partially_refunded"];
const PAYMENT_PROVIDERS_QUERY: PaymentProviderId[] = ["razorpay", "stripe", "cashfree", "phonepe", "paypal"];

/**
 * POST /api/admin/payments, GET /api/admin/payments
 *
 * Payments Integration (Phase 6), Module 6.4 — "Payment Intent" /
 * "Orders" / "Checkout Session": creates a real checkout session
 * against the requested provider and returns a real, hosted
 * `checkoutUrl` an admin can share with the customer (or, once a
 * public checkout page exists, redirect to). "Transaction History"
 * is this same list, filterable — no separate transactions endpoint.
 *
 * ⚠️ requiredRole: "admin" for POST — creating a checkout session is a
 * real, standing request for money against a real payment gateway,
 * the same tier this app already reserves for provider connect/
 * disconnect (Module 6.1). GET is "manager" — viewing transaction
 * history is revenue-sensitive but not itself a mutating action,
 * matching 7.1's own Pipeline Analytics precedent.
 */
async function handleCreatePayment(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body) throw new ValidationApiError([{ field: "root", message: "Request body must be valid JSON." }]);

  const result = await paymentService.createPayment(body, { actorId: ctx.authContext.userId, requestId: ctx.requestId });
  if (!result.success) throw new ValidationApiError(result.errors);
  return apiSuccess({ payment: result.payment }, 201);
}

async function handleListPayments(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const status = searchParams.get("status");
  const provider = searchParams.get("provider");
  const result = await paymentService.listPayments(
    {
      status: status && PAYMENT_STATUSES.includes(status as PaymentStatus) ? (status as PaymentStatus) : undefined,
      provider: provider && PAYMENT_PROVIDERS_QUERY.includes(provider as PaymentProviderId) ? (provider as PaymentProviderId) : undefined,
      leadId: searchParams.get("leadId") || undefined,
      registrationId: searchParams.get("registrationId") || undefined,
      opportunityId: searchParams.get("opportunityId") || undefined,
      campaignId: searchParams.get("campaignId") || undefined,
      relatedEntityType: searchParams.get("relatedEntityType") || undefined,
      relatedEntityId: searchParams.get("relatedEntityId") || undefined,
    },
    page,
    limit,
  );
  return apiSuccess({ ...result });
}

export const POST = withApiRoute("admin.payments.create", handleCreatePayment, {
  requiredRole: "admin",
  // Reaches a real vendor payment API — the same tighter ceiling 6.2's
  // upload route and 6.3's meeting-schedule route already use for a
  // real vendor call.
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const GET = withApiRoute("admin.payments.list", handleListPayments, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
