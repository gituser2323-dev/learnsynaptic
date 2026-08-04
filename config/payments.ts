/**
 * Single source of truth for Payments Integration (Phase 6, Module 6.4)
 * provider credentials — server-only, never NEXT_PUBLIC_*, the same
 * "one exported const object, process.env.X || '' per field" shape
 * config/storage.ts / config/calendar.ts already established.
 *
 * Unlike Storage's single STORAGE_PROVIDER selector, every payment
 * provider is independently connectable through the Integrations
 * Registry (Module 6.1) — the same "no single active provider" shape
 * Module 6.3's calendar providers already use, since a real deployment
 * may reasonably run Razorpay for India and Stripe for international
 * fees simultaneously. Each provider's own credentials below being
 * configured only makes its "Connect" button functional — every real
 * paymentService call additionally requires the resulting
 * IntegrationConnection to show connected+enabled first (see
 * paymentService.ts's own assertProviderReady()), the identical
 * two-factor gate 6.2/6.3 already established.
 *
 * A payment provider's real credential is a single API key pair for
 * the whole deployment (not a per-connection secret an admin pastes),
 * the same shape AWS S3/Cloudinary already use — so `credentialRef`
 * stays `{type:"env"}` and nothing here is ever encrypted into the
 * database; the values live only in the process environment.
 */

export const RAZORPAY_CONFIG = {
  keyId: process.env.RAZORPAY_KEY_ID || "",
  keySecret: process.env.RAZORPAY_KEY_SECRET || "",
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
};

export const STRIPE_CONFIG = {
  secretKey: process.env.STRIPE_SECRET_KEY || "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
};

export const CASHFREE_CONFIG = {
  appId: process.env.CASHFREE_APP_ID || "",
  secretKey: process.env.CASHFREE_SECRET_KEY || "",
  webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET || "",
  /** Cashfree's own sandbox/production API host differ by full base
   *  URL, not a path suffix — defaults to production, same "explicit
   *  opt-in to sandbox" posture as every other vendor config in this
   *  app. */
  apiBaseUrl: process.env.CASHFREE_API_BASE_URL || "https://api.cashfree.com/pg",
};

/** PhonePe and PayPal are explicitly named as future providers in this
 *  module's own mission — catalogued (providerCatalog.ts) and
 *  registry-wired (registry.ts) so a later pass only has to fill these
 *  two config blocks in and swap the scaffold adapter for a real one,
 *  never touching paymentService.ts or any CRM integration point. No
 *  real code calls these today; see providers/phonepe.provider.ts and
 *  providers/paypal.provider.ts for the disclosed
 *  PaymentProviderNotImplementedError they throw instead. */
export const PHONEPE_CONFIG = {
  merchantId: process.env.PHONEPE_MERCHANT_ID || "",
  saltKey: process.env.PHONEPE_SALT_KEY || "",
};

export const PAYPAL_CONFIG = {
  clientId: process.env.PAYPAL_CLIENT_ID || "",
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
};
