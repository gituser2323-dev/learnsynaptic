import { razorpayProvider } from "./providers/razorpay.provider";
import { stripeProvider } from "./providers/stripe.provider";
import { cashfreeProvider } from "./providers/cashfree.provider";
import { phonepeProvider } from "./providers/phonepe.provider";
import { paypalProvider } from "./providers/paypal.provider";
import type { PaymentProvider, PaymentProviderId } from "./types";

/**
 * Payments Integration (Phase 6), Module 6.4 — the one place allowed to
 * import a concrete provider adapter, mirroring
 * lib/services/calendar/registry.ts exactly. paymentService.ts never
 * imports a provider module directly — this is the whole point of
 * "never tightly couple business logic to Razorpay" from the module's
 * own mission: a future 6th provider is one new entry here plus its
 * own adapter file, never a new branch anywhere else in this module or
 * the CRM it integrates with.
 */
const PAYMENT_PROVIDERS: Record<PaymentProviderId, PaymentProvider> = {
  razorpay: razorpayProvider,
  stripe: stripeProvider,
  cashfree: cashfreeProvider,
  phonepe: phonepeProvider,
  paypal: paypalProvider,
};

export const PAYMENT_PROVIDER_IDS: PaymentProviderId[] = Object.keys(PAYMENT_PROVIDERS) as PaymentProviderId[];

export function isPaymentProviderId(value: string): value is PaymentProviderId {
  return (PAYMENT_PROVIDER_IDS as string[]).includes(value);
}

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider {
  return PAYMENT_PROVIDERS[id];
}
