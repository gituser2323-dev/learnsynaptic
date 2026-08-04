import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

/**
 * Payments Integration (Phase 6), Module 6.4 — each real provider's
 * own signature verification and webhook-payload parsing, tested
 * against hand-computed real signatures (the same HMAC scheme each
 * vendor's own real webhook delivery would use) rather than only
 * against the provider's own signing function — a bug in
 * verifyWebhookSignature() that happened to match a bug in a would-be
 * signing helper could otherwise pass unnoticed. Config env vars are
 * stubbed via vi.stubEnv + vi.resetModules() so each test gets a fresh
 * module instance reading the stubbed secret, the same technique this
 * codebase already uses for other env-driven module-load-time
 * constants.
 */

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllEnvs();
});

describe("razorpayProvider", () => {
  it("verifies a real HMAC-SHA256 signature over the raw body and rejects a tampered one", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "rzp_test_secret");
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "whsec_razorpay");
    const { razorpayProvider } = await import("./razorpay.provider");

    const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } } });
    const signature = createHmac("sha256", "whsec_razorpay").update(rawBody).digest("hex");

    expect(razorpayProvider.verifyWebhookSignature(rawBody, { "x-razorpay-signature": signature })).toBe(true);
    expect(razorpayProvider.verifyWebhookSignature(rawBody + "tampered", { "x-razorpay-signature": signature })).toBe(false);
    expect(razorpayProvider.verifyWebhookSignature(rawBody, {})).toBe(false);
  });

  it("returns false when no webhook secret is configured, rather than accepting anything", async () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    const { razorpayProvider } = await import("./razorpay.provider");
    expect(razorpayProvider.verifyWebhookSignature("{}", { "x-razorpay-signature": "anything" })).toBe(false);
  });

  it("parses payment.captured/payment.failed/refund.processed into the generic shape", async () => {
    const { razorpayProvider } = await import("./razorpay.provider");

    const captured = razorpayProvider.parseWebhookEvent(
      JSON.stringify({ event: "payment.captured", event_id: "evt_1", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 250000, currency: "INR" } } } }),
    );
    expect(captured).toEqual({ type: "payment.succeeded", providerEventId: "evt_1", providerOrderId: "order_1", providerPaymentId: "pay_1", amountInSmallestUnit: 250000, currency: "INR" });

    const failed = razorpayProvider.parseWebhookEvent(
      JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_2", order_id: "order_2", error_description: "Card declined" } } } }),
    );
    expect(failed.type).toBe("payment.failed");
    expect(failed.failureReason).toBe("Card declined");

    const unrecognized = razorpayProvider.parseWebhookEvent(JSON.stringify({ event: "order.paid", payload: {} }));
    expect(unrecognized.type).toBe("unrecognized");

    expect(razorpayProvider.parseWebhookEvent("not json").type).toBe("unrecognized");
  });
});

describe("stripeProvider", () => {
  it("verifies the t=/v1= signature scheme over `${timestamp}.${rawBody}` and rejects a tampered body", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_key");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_stripe");
    const { stripeProvider } = await import("./stripe.provider");

    const rawBody = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1" } } });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const v1 = createHmac("sha256", "whsec_stripe").update(`${timestamp}.${rawBody}`).digest("hex");

    expect(stripeProvider.verifyWebhookSignature(rawBody, { "stripe-signature": `t=${timestamp},v1=${v1}` })).toBe(true);
    expect(stripeProvider.verifyWebhookSignature(rawBody + "x", { "stripe-signature": `t=${timestamp},v1=${v1}` })).toBe(false);
  });

  it("rejects a signature whose timestamp is outside the tolerance window (real replay protection)", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_stripe");
    const { stripeProvider } = await import("./stripe.provider");

    const rawBody = "{}";
    const staleTimestamp = (Math.floor(Date.now() / 1000) - 10 * 60).toString(); // 10 minutes old
    const v1 = createHmac("sha256", "whsec_stripe").update(`${staleTimestamp}.${rawBody}`).digest("hex");
    expect(stripeProvider.verifyWebhookSignature(rawBody, { "stripe-signature": `t=${staleTimestamp},v1=${v1}` })).toBe(false);
  });

  it("parses checkout.session.completed/payment_intent.payment_failed/charge.refunded", async () => {
    const { stripeProvider } = await import("./stripe.provider");

    const completed = stripeProvider.parseWebhookEvent(
      JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_intent: "pi_1", amount_total: 250000, currency: "inr" } } }),
    );
    expect(completed).toEqual({ type: "payment.succeeded", providerEventId: "evt_1", providerOrderId: "cs_1", providerPaymentId: "pi_1", amountInSmallestUnit: 250000, currency: "INR" });

    const failed = stripeProvider.parseWebhookEvent(
      JSON.stringify({ id: "evt_2", type: "payment_intent.payment_failed", data: { object: { id: "pi_2", last_payment_error: { message: "Insufficient funds" } } } }),
    );
    expect(failed.failureReason).toBe("Insufficient funds");

    expect(stripeProvider.parseWebhookEvent(JSON.stringify({ id: "evt_3", type: "customer.created", data: { object: {} } })).type).toBe("unrecognized");
  });
});

describe("cashfreeProvider", () => {
  it("verifies HMAC-SHA256 over `${timestamp}${rawBody}` base64-encoded and rejects a tampered body", async () => {
    vi.stubEnv("CASHFREE_APP_ID", "cf_app");
    vi.stubEnv("CASHFREE_SECRET_KEY", "cf_secret");
    vi.stubEnv("CASHFREE_WEBHOOK_SECRET", "whsec_cashfree");
    const { cashfreeProvider } = await import("./cashfree.provider");

    const rawBody = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: "order_1" } } });
    const timestamp = "1700000000";
    const signature = createHmac("sha256", "whsec_cashfree").update(`${timestamp}${rawBody}`).digest("base64");

    expect(cashfreeProvider.verifyWebhookSignature(rawBody, { "x-webhook-signature": signature, "x-webhook-timestamp": timestamp })).toBe(true);
    expect(cashfreeProvider.verifyWebhookSignature(rawBody + "x", { "x-webhook-signature": signature, "x-webhook-timestamp": timestamp })).toBe(false);
    expect(cashfreeProvider.verifyWebhookSignature(rawBody, { "x-webhook-signature": signature })).toBe(false); // missing timestamp
  });

  it("parses PAYMENT_SUCCESS_WEBHOOK/PAYMENT_FAILED_WEBHOOK/REFUND_STATUS_WEBHOOK", async () => {
    const { cashfreeProvider } = await import("./cashfree.provider");

    const success = cashfreeProvider.parseWebhookEvent(
      JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: "order_1", order_amount: 2500, order_currency: "INR" }, payment: { cf_payment_id: 12345 } } }),
    );
    expect(success).toEqual({ type: "payment.succeeded", providerOrderId: "order_1", providerPaymentId: "12345", amountInSmallestUnit: 250000, currency: "INR" });

    const failed = cashfreeProvider.parseWebhookEvent(
      JSON.stringify({ type: "PAYMENT_FAILED_WEBHOOK", data: { order: { order_id: "order_2" }, payment: { payment_message: "Declined" } } }),
    );
    expect(failed.type).toBe("payment.failed");
    expect(failed.failureReason).toBe("Declined");

    expect(cashfreeProvider.parseWebhookEvent(JSON.stringify({ type: "LINK_EXPIRED_WEBHOOK" })).type).toBe("unrecognized");
  });
});

describe("phonepeProvider / paypalProvider — disclosed scaffolds", () => {
  it("throw PaymentProviderNotImplementedError on every real method, never fabricating success", async () => {
    const { phonepeProvider } = await import("./phonepe.provider");
    const { paypalProvider } = await import("./paypal.provider");
    const { PaymentProviderNotImplementedError } = await import("../errors");

    for (const provider of [phonepeProvider, paypalProvider]) {
      await expect(provider.createCheckoutSession({} as never)).rejects.toThrow(PaymentProviderNotImplementedError);
      await expect(provider.getPaymentStatus("x")).rejects.toThrow(PaymentProviderNotImplementedError);
      await expect(provider.createRefund("x")).rejects.toThrow(PaymentProviderNotImplementedError);
      expect(provider.verifyWebhookSignature("{}", {})).toBe(false);
      expect(provider.parseWebhookEvent("{}").type).toBe("unrecognized");
    }
  });
});
