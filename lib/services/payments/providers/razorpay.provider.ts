import { createHmac, timingSafeEqual } from "crypto";
import { RAZORPAY_CONFIG } from "@/config/payments";
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
 * Payments Integration (Phase 6), Module 6.4 — real Razorpay adapter.
 * Uses Razorpay's own documented Payment Links API
 * (https://api.razorpay.com/v1/payment_links) for checkout rather than
 * the Orders API + client-side Checkout.js widget: a real, hosted,
 * redirect-based URL the customer's browser goes straight to, no
 * vendor JS SDK needing to be embedded on any LearnSynaptic page — the
 * same "server-to-server, redirect for the human part" shape Stripe's
 * own Checkout Session already uses, applied consistently across every
 * real provider in this module rather than mixing integration styles.
 */

function assertConfigured(): void {
  if (!RAZORPAY_CONFIG.keyId || !RAZORPAY_CONFIG.keySecret) {
    throw new PaymentProviderNotConfiguredError("razorpay", "missing env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET");
  }
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${RAZORPAY_CONFIG.keyId}:${RAZORPAY_CONFIG.keySecret}`).toString("base64")}`;
}

async function razorpayFetch(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: authHeader(), "Content-Type": "application/json" },
    signal: AbortSignal.timeout(PAYMENT_PROVIDER_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = (body.error as Record<string, unknown> | undefined)?.description as string | undefined;
    throw new PaymentProviderError("razorpay", message || `HTTP ${response.status}`);
  }
  return body;
}

export const razorpayProvider: PaymentProvider = {
  id: "razorpay",

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<ProviderCheckoutResult> {
    assertConfigured();
    const body = await razorpayFetch("/payment_links", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountInSmallestUnit,
        currency: input.currency,
        description: input.purpose,
        customer: {
          name: input.customerName,
          email: input.customerEmail,
          contact: input.customerPhone,
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: input.metadata,
        callback_url: input.returnUrl,
        callback_method: "get",
      }),
    });
    return { providerOrderId: body.id as string, checkoutUrl: body.short_url as string };
  },

  async getPaymentStatus(providerOrderId: string): Promise<ProviderPaymentStatusResult> {
    assertConfigured();
    const body = await razorpayFetch(`/payment_links/${providerOrderId}`, { method: "GET" });
    const status = body.status as string;
    const payments = (body.payments as Record<string, unknown>[] | undefined) ?? [];
    const capturedPayment = payments.find((p) => p.status === "captured");

    if (status === "paid" && capturedPayment) {
      return {
        state: "succeeded",
        providerPaymentId: capturedPayment.payment_id as string,
        amountInSmallestUnit: body.amount_paid as number,
        currency: body.currency as string,
      };
    }
    if (status === "expired" || status === "cancelled") {
      return { state: "failed", failureReason: `Payment link ${status}.` };
    }
    return { state: "pending" };
  },

  async createRefund(providerPaymentId: string, amountInSmallestUnit?: number, reason?: string): Promise<ProviderRefundResult> {
    assertConfigured();
    const body = await razorpayFetch(`/payments/${providerPaymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({
        amount: amountInSmallestUnit,
        notes: reason ? { reason } : undefined,
      }),
    });
    return {
      providerRefundId: body.id as string,
      amountInSmallestUnit: body.amount as number,
      state: body.status === "processed" ? "succeeded" : "pending",
    };
  },

  /** Razorpay signs the raw webhook body with HMAC-SHA256 using the
   *  dashboard-configured webhook secret, delivered as the
   *  `X-Razorpay-Signature` header — real, documented scheme. */
  verifyWebhookSignature(rawBody: string, headers: Record<string, string | undefined>): boolean {
    if (!RAZORPAY_CONFIG.webhookSecret) return false;
    const signature = headers["x-razorpay-signature"];
    if (!signature) return false;
    const expected = createHmac("sha256", RAZORPAY_CONFIG.webhookSecret).update(rawBody).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  },

  /** Real Razorpay webhook payload shape:
   *  `{ event: "payment.captured", payload: { payment: { entity: {...} } } }`. */
  parseWebhookEvent(rawBody: string): ParsedWebhookEvent {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { type: "unrecognized" };
    }

    const event = parsed.event as string | undefined;
    const payload = parsed.payload as Record<string, unknown> | undefined;

    if (event === "payment.captured") {
      const payment = (payload?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
      return {
        type: "payment.succeeded",
        providerEventId: parsed.event_id as string | undefined,
        providerOrderId: payment?.order_id as string | undefined,
        providerPaymentId: payment?.id as string | undefined,
        amountInSmallestUnit: payment?.amount as number | undefined,
        currency: payment?.currency as string | undefined,
      };
    }
    if (event === "payment.failed") {
      const payment = (payload?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
      return {
        type: "payment.failed",
        providerEventId: parsed.event_id as string | undefined,
        providerOrderId: payment?.order_id as string | undefined,
        providerPaymentId: payment?.id as string | undefined,
        failureReason: (payment?.error_description as string | undefined) || "Payment failed.",
      };
    }
    if (event === "refund.processed") {
      const refund = (payload?.refund as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
      return {
        type: "refund.succeeded",
        providerEventId: parsed.event_id as string | undefined,
        providerPaymentId: refund?.payment_id as string | undefined,
        providerRefundId: refund?.id as string | undefined,
        amountInSmallestUnit: refund?.amount as number | undefined,
      };
    }
    return { type: "unrecognized", providerEventId: parsed.event_id as string | undefined };
  },
};
