import { NextResponse } from "next/server";
import { withApiRoute } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { paymentService, isPaymentProviderId, PaymentWebhookSignatureInvalidError } from "@/lib/services/payments";
import { createLogger } from "@/lib/logger";

const logger = createLogger({ service: "payments.webhook" });

/**
 * POST /api/webhooks/payments/[provider]
 *
 * Payments Integration (Phase 6), Module 6.4 — the real inbound
 * webhook receiver every connected gateway (Razorpay/Stripe/Cashfree)
 * calls on a payment/refund state change. Deliberately public/
 * unauthenticated — the same posture app/api/webhooks/whatsapp/route.ts
 * already takes — real security here is the provider's own signature
 * verification (paymentService.handleProviderWebhook →
 * PaymentProvider.verifyWebhookSignature), never a session check no
 * external vendor could ever pass.
 *
 * Reads the raw text body (not `request.json()`) because every
 * provider's own signature is computed over the exact bytes received —
 * re-serializing a parsed-and-reparsed body would silently break
 * verification for a payload whose real JSON key order or whitespace
 * differs from what was signed.
 */
async function handlePaymentWebhook(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { provider } = ctx.params;
  if (!isPaymentProviderId(provider)) {
    return NextResponse.json({ received: false }, { status: 404 });
  }

  const rawBody = await request.text();
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  try {
    await paymentService.handleProviderWebhook(provider, rawBody, headers);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    if (error instanceof PaymentWebhookSignatureInvalidError) {
      logger.warn("payments.webhook_signature_invalid", { provider });
      return NextResponse.json({ received: false }, { status: 401 });
    }
    // A processing failure (e.g. a downstream DB error) still returns
    // 200 — never 500 — for a signature that DID verify: this app's
    // own bug shouldn't make the vendor believe delivery failed and
    // retry indefinitely against an endpoint that will keep failing
    // the same way. The PaymentWebhookEvent row (outcome: "error")
    // already recorded is this app's own real signal to investigate,
    // not a retry storm from the vendor.
    logger.error("payments.webhook_processing_failed", { provider, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

export const POST = withApiRoute("webhooks.payments.receive", handlePaymentWebhook, {
  rateLimit: { limit: 120, windowMs: 60_000 },
});
