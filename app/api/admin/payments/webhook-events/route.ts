import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams } from "@/lib/api";
import { paymentService } from "@/lib/services/payments";
import type { PaymentProviderId, PaymentWebhookOutcome } from "@/lib/services/payments";

const PAYMENT_PROVIDERS_QUERY: PaymentProviderId[] = ["razorpay", "stripe", "cashfree", "phonepe", "paypal"];
const WEBHOOK_OUTCOMES: PaymentWebhookOutcome[] = ["processed", "duplicate", "signature_invalid", "unrecognized", "error"];

/**
 * GET /api/admin/payments/webhook-events
 *
 * Payments Integration (Phase 6), Module 6.4 — "Webhook Status": every
 * inbound provider webhook this app has received, regardless of
 * outcome (including a signature failure or an unrecognized event
 * type) — the same "Webhook Deliveries" visibility Module 2.4 already
 * established for WhatsApp's own inbound webhooks, applied here to
 * payment providers specifically.
 */
async function handleListWebhookEvents(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const provider = searchParams.get("provider");
  const outcome = searchParams.get("outcome");
  const result = await paymentService.listWebhookEvents(
    {
      provider: provider && PAYMENT_PROVIDERS_QUERY.includes(provider as PaymentProviderId) ? (provider as PaymentProviderId) : undefined,
      outcome: outcome && WEBHOOK_OUTCOMES.includes(outcome as PaymentWebhookOutcome) ? (outcome as PaymentWebhookOutcome) : undefined,
    },
    page,
    limit,
  );
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.payments.webhookEvents.list", handleListWebhookEvents, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
