import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { CASHFREE_CONFIG } from "@/config/payments";
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
 * Payments Integration (Phase 6), Module 6.4 — real Cashfree adapter
 * (India's own second real gateway alongside Razorpay, per this
 * module's own mission). Uses Cashfree's real Payment Links API
 * (`/pg/links`) for the same reason Razorpay's own adapter does: a
 * real, hosted, redirect-based URL, no vendor JS SDK to embed —
 * consistent with Stripe's Checkout Session shape across every real
 * provider here. Cashfree's Refunds API operates on the underlying
 * Order id, which for a Payment Link is the `link_id` itself
 * (Cashfree's own documented behavior — a Payment Link creates one
 * implicit Order sharing its id) — `providerPaymentId` in this
 * module's own generic shape is therefore populated with the CF
 * payment id Cashfree returns once paid, and refunds are issued
 * against the order id captured separately by paymentService from
 * `providerOrderId`, not `providerPaymentId` — see paymentService.ts's
 * own refundPayment() for how that distinction is threaded through.
 */

function assertConfigured(): void {
  if (!CASHFREE_CONFIG.appId || !CASHFREE_CONFIG.secretKey) {
    throw new PaymentProviderNotConfiguredError("cashfree", "missing env vars: CASHFREE_APP_ID, CASHFREE_SECRET_KEY");
  }
}

async function cashfreeFetch(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`${CASHFREE_CONFIG.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      "x-client-id": CASHFREE_CONFIG.appId,
      "x-client-secret": CASHFREE_CONFIG.secretKey,
      "x-api-version": "2023-08-01",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(PAYMENT_PROVIDER_TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = (body.message as string | undefined) || (body.error_description as string | undefined);
    throw new PaymentProviderError("cashfree", message || `HTTP ${response.status}`);
  }
  return body;
}

export const cashfreeProvider: PaymentProvider = {
  id: "cashfree",

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<ProviderCheckoutResult> {
    assertConfigured();
    const linkId = `link_${randomUUID().replace(/-/g, "")}`;
    const body = await cashfreeFetch("/links", {
      method: "POST",
      body: JSON.stringify({
        link_id: linkId,
        // Cashfree's own smallest-unit convention is the major unit
        // (rupees, not paise) for this API — the one real amount-unit
        // difference between vendors in this module, converted here so
        // paymentService itself never has to know about it.
        link_amount: input.amountInSmallestUnit / 100,
        link_currency: input.currency,
        link_purpose: input.purpose,
        customer_details: {
          customer_name: input.customerName,
          customer_email: input.customerEmail,
          customer_phone: input.customerPhone || "9999999999",
        },
        link_notify: { send_sms: false, send_email: false },
        link_meta: { return_url: input.returnUrl },
        link_notes: input.metadata,
      }),
    });
    return { providerOrderId: body.link_id as string, checkoutUrl: body.link_url as string };
  },

  async getPaymentStatus(providerOrderId: string): Promise<ProviderPaymentStatusResult> {
    assertConfigured();
    const body = await cashfreeFetch(`/links/${providerOrderId}`, { method: "GET" });
    const status = body.link_status as string;

    if (status === "PAID") {
      const orders = (body.link_orders as Record<string, unknown>[] | undefined) ?? [];
      const paidOrder = orders.find((o) => o.order_status === "PAID") ?? orders[0];
      return {
        state: "succeeded",
        providerPaymentId: (paidOrder?.cf_payment_id as string | number | undefined)?.toString(),
        amountInSmallestUnit: Math.round((body.link_amount_paid as number) * 100),
        currency: body.link_currency as string,
      };
    }
    if (status === "EXPIRED" || status === "CANCELLED") {
      return { state: "failed", failureReason: `Payment link ${status.toLowerCase()}.` };
    }
    return { state: "pending" };
  },

  async createRefund(providerPaymentId: string, amountInSmallestUnit?: number, reason?: string): Promise<ProviderRefundResult> {
    assertConfigured();
    // providerPaymentId here is the underlying Cashfree Order id (see
    // this file's own doc comment) — paymentService passes
    // payment.providerOrderId, not providerPaymentId, for Cashfree
    // specifically.
    const refundId = `refund_${randomUUID().replace(/-/g, "")}`;
    const body = await cashfreeFetch(`/orders/${providerPaymentId}/refunds`, {
      method: "POST",
      body: JSON.stringify({
        refund_id: refundId,
        refund_amount: amountInSmallestUnit ? amountInSmallestUnit / 100 : undefined,
        refund_note: reason,
      }),
    });
    const status = body.refund_status as string;
    return {
      providerRefundId: body.refund_id as string,
      amountInSmallestUnit: Math.round((body.refund_amount as number) * 100),
      state: status === "SUCCESS" ? "succeeded" : status === "FAILED" ? "failed" : "pending",
    };
  },

  /** Cashfree's own real signing scheme: HMAC-SHA256 over
   *  `${timestamp}${rawBody}` (the `x-webhook-timestamp` header value,
   *  no separator), base64-encoded, compared against
   *  `x-webhook-signature` — real, documented replay-resistant scheme
   *  (the timestamp is part of what's signed). */
  verifyWebhookSignature(rawBody: string, headers: Record<string, string | undefined>): boolean {
    if (!CASHFREE_CONFIG.webhookSecret) return false;
    const signature = headers["x-webhook-signature"];
    const timestamp = headers["x-webhook-timestamp"];
    if (!signature || !timestamp) return false;

    const expected = createHmac("sha256", CASHFREE_CONFIG.webhookSecret).update(`${timestamp}${rawBody}`).digest("base64");
    const expectedBuffer = Buffer.from(expected, "base64");
    const providedBuffer = Buffer.from(signature, "base64");
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  },

  /** Real Cashfree webhook shape: `{ type: "PAYMENT_SUCCESS_WEBHOOK",
   *  data: { order: {...}, payment: {...} } }`. */
  parseWebhookEvent(rawBody: string): ParsedWebhookEvent {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { type: "unrecognized" };
    }

    const type = parsed.type as string | undefined;
    const data = parsed.data as Record<string, unknown> | undefined;
    const order = data?.order as Record<string, unknown> | undefined;
    const payment = data?.payment as Record<string, unknown> | undefined;

    if (type === "PAYMENT_SUCCESS_WEBHOOK") {
      return {
        type: "payment.succeeded",
        providerOrderId: order?.order_id as string | undefined,
        providerPaymentId: (payment?.cf_payment_id as string | number | undefined)?.toString(),
        amountInSmallestUnit: order?.order_amount ? Math.round((order.order_amount as number) * 100) : undefined,
        currency: order?.order_currency as string | undefined,
      };
    }
    if (type === "PAYMENT_FAILED_WEBHOOK" || type === "PAYMENT_USER_DROPPED_WEBHOOK") {
      return {
        type: "payment.failed",
        providerOrderId: order?.order_id as string | undefined,
        providerPaymentId: (payment?.cf_payment_id as string | number | undefined)?.toString(),
        failureReason: (payment?.payment_message as string | undefined) || "Payment failed.",
      };
    }
    if (type === "REFUND_STATUS_WEBHOOK") {
      const refund = data?.refund as Record<string, unknown> | undefined;
      return {
        type: "refund.succeeded",
        providerOrderId: order?.order_id as string | undefined,
        providerRefundId: refund?.refund_id as string | undefined,
        amountInSmallestUnit: refund?.refund_amount ? Math.round((refund.refund_amount as number) * 100) : undefined,
      };
    }
    return { type: "unrecognized" };
  },
};
