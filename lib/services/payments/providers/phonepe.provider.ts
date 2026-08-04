import { PaymentProviderNotImplementedError } from "../errors";
import type { PaymentProvider } from "../types";

/**
 * Payments Integration (Phase 6), Module 6.4 — PhonePe is explicitly
 * named "(future)" in this module's own mission, not a provider to
 * implement now. Catalogued (providerCatalog.ts) and registry-wired
 * (registry.ts) so a later pass only has to fill in config/payments.ts's
 * PHONEPE_CONFIG and replace this file's own body with a real adapter
 * — every other part of the system (paymentService, the Admin UI, CRM
 * integration, audit logging) already works generically against the
 * PaymentProvider interface and needs no change. Every method throws
 * the same disclosed, honest error rather than silently no-opping or
 * returning fabricated data — the same posture WhatsApp's AiSensy/
 * Interakt/WATI/Gallabox and Email's SendGrid/Resend scaffolds already
 * established for a vendor this pass didn't implement.
 */
export const phonepeProvider: PaymentProvider = {
  id: "phonepe",
  async createCheckoutSession() {
    throw new PaymentProviderNotImplementedError("phonepe");
  },
  async getPaymentStatus() {
    throw new PaymentProviderNotImplementedError("phonepe");
  },
  async createRefund() {
    throw new PaymentProviderNotImplementedError("phonepe");
  },
  verifyWebhookSignature() {
    return false;
  },
  parseWebhookEvent() {
    return { type: "unrecognized" };
  },
};
