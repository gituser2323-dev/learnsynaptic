import { createHmac, timingSafeEqual } from "crypto";
import { STRIPE_CONFIG } from "@/config/payments";
import { PAYMENT_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { PaymentProviderNotConfiguredError, PaymentProviderError } from "../errors";
import type {
  CreateCheckoutSessionInput,
  ParsedWebhookEvent,
  PaymentProvider,
  ProviderCheckoutResult,
  ProviderPaymentStatusResult,
  ProviderRefundResult,
} from "../types";

/**
 * Payments Integration (Phase 6), Module 6.4 — real Stripe adapter.
 * Uses Stripe's own real Checkout Sessions API — a real, hosted,
 * redirect-based URL (`checkout.stripe.com`), the same shape Razorpay's
 * Payment Links and Cashfree's Payment Links both use here, so this
 * module has one consistent "server creates a session, customer's
 * browser redirects to a vendor-hosted page, vendor redirects back"
 * flow across all three real providers. Stripe's API is form-encoded,
 * not JSON — the one real request-shape difference from Razorpay/
 * Cashfree, handled locally in requestBody() below rather than forcing
 * a shared HTTP helper across providers with genuinely different wire
 * formats.
 */

function assertConfigured(): void {
  if (!STRIPE_CONFIG.secretKey) {
    throw new PaymentProviderNotConfiguredError("stripe", "missing env var: STRIPE_SECRET_KEY");
  }
}

function toFormBody(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.append(key, String(value));
  }
  return search.toString();
}

async function stripeFetch(path: string, init: { method: string; body?: string }): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${STRIPE_CONFIG.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init.body,
    signal: AbortSignal.timeout(PAYMENT_PROVIDER_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = (body.error as Record<string, unknown> | undefined)?.message as string | undefined;
    throw new PaymentProviderError("stripe", message || `HTTP ${response.status}`);
  }
  return body;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<ProviderCheckoutResult> {
    assertConfigured();
    const params: Record<string, string | number | undefined> = {
      mode: "payment",
      "line_items[0][price_data][currency]": input.currency.toLowerCase(),
      "line_items[0][price_data][product_data][name]": input.purpose,
      "line_items[0][price_data][unit_amount]": input.amountInSmallestUnit,
      "line_items[0][quantity]": 1,
      success_url: input.returnUrl,
      cancel_url: input.returnUrl,
      customer_email: input.customerEmail,
    };
    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      params[`metadata[${key}]`] = value;
    }

    const body = await stripeFetch("/checkout/sessions", { method: "POST", body: toFormBody(params) });
    return { providerOrderId: body.id as string, checkoutUrl: body.url as string };
  },

  async getPaymentStatus(providerOrderId: string): Promise<ProviderPaymentStatusResult> {
    assertConfigured();
    const body = await stripeFetch(`/checkout/sessions/${providerOrderId}`, { method: "GET" });
    const paymentStatus = body.payment_status as string;

    if (paymentStatus === "paid") {
      return {
        state: "succeeded",
        providerPaymentId: body.payment_intent as string,
        amountInSmallestUnit: body.amount_total as number,
        currency: (body.currency as string)?.toUpperCase(),
      };
    }
    if (body.status === "expired") {
      return { state: "failed", failureReason: "Checkout session expired." };
    }
    return { state: "pending" };
  },

  async createRefund(providerPaymentId: string, amountInSmallestUnit?: number, reason?: string): Promise<ProviderRefundResult> {
    assertConfigured();
    const body = await stripeFetch("/refunds", {
      method: "POST",
      body: toFormBody({ payment_intent: providerPaymentId, amount: amountInSmallestUnit, reason: reason ? "requested_by_customer" : undefined }),
    });
    return {
      providerRefundId: body.id as string,
      amountInSmallestUnit: body.amount as number,
      state: body.status === "succeeded" ? "succeeded" : body.status === "failed" ? "failed" : "pending",
    };
  },

  /** Stripe's own real signing scheme: the `Stripe-Signature` header is
   *  `t=<timestamp>,v1=<hex hmac>`, computed over `${t}.${rawBody}`. A
   *  5-minute tolerance window guards against a stale, replayed
   *  signature — real replay protection, not just format-checking. */
  verifyWebhookSignature(rawBody: string, headers: Record<string, string | undefined>): boolean {
    if (!STRIPE_CONFIG.webhookSecret) return false;
    const header = headers["stripe-signature"];
    if (!header) return false;

    const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1) return false;

    const toleranceSeconds = 5 * 60;
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > toleranceSeconds) return false;

    const expected = createHmac("sha256", STRIPE_CONFIG.webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(v1, "hex");
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  },

  /** Real Stripe event shape: `{ id, type, data: { object: {...} } }`. */
  parseWebhookEvent(rawBody: string): ParsedWebhookEvent {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { type: "unrecognized" };
    }

    const type = parsed.type as string | undefined;
    const object = (parsed.data as Record<string, unknown> | undefined)?.object as Record<string, unknown> | undefined;
    const providerEventId = parsed.id as string | undefined;

    if (type === "checkout.session.completed") {
      return {
        type: "payment.succeeded",
        providerEventId,
        providerOrderId: object?.id as string | undefined,
        providerPaymentId: object?.payment_intent as string | undefined,
        amountInSmallestUnit: object?.amount_total as number | undefined,
        currency: (object?.currency as string | undefined)?.toUpperCase(),
      };
    }
    if (type === "payment_intent.payment_failed") {
      return {
        type: "payment.failed",
        providerEventId,
        providerPaymentId: object?.id as string | undefined,
        failureReason: ((object?.last_payment_error as Record<string, unknown> | undefined)?.message as string | undefined) || "Payment failed.",
      };
    }
    if (type === "charge.refunded") {
      return {
        type: "refund.succeeded",
        providerEventId,
        providerPaymentId: object?.payment_intent as string | undefined,
        amountInSmallestUnit: object?.amount_refunded as number | undefined,
      };
    }
    return { type: "unrecognized", providerEventId };
  },
};
