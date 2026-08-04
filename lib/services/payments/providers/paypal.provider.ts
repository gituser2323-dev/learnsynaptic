import { PaymentProviderNotImplementedError } from "../errors";
import type { PaymentProvider } from "../types";

/**
 * Payments Integration (Phase 6), Module 6.4 — PayPal is explicitly
 * named "(future)" in this module's own mission. See
 * phonepe.provider.ts's own doc comment — identical reasoning and
 * posture, applied to PayPal instead.
 */
export const paypalProvider: PaymentProvider = {
  id: "paypal",
  async createCheckoutSession() {
    throw new PaymentProviderNotImplementedError("paypal");
  },
  async getPaymentStatus() {
    throw new PaymentProviderNotImplementedError("paypal");
  },
  async createRefund() {
    throw new PaymentProviderNotImplementedError("paypal");
  },
  verifyWebhookSignature() {
    return false;
  },
  parseWebhookEvent() {
    return { type: "unrecognized" };
  },
};
