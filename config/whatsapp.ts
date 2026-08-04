import type { WhatsAppProviderId } from "@/lib/services/whatsapp/types";

/**
 * Single source of truth for WhatsApp provider selection and credentials.
 *
 * Deliberately NOT NEXT_PUBLIC_* — unlike config/analytics.ts (which must
 * expose GA4/Meta Pixel IDs to the browser because those scripts run
 * client-side), WhatsApp sending happens server-side only. These values
 * must never reach the client bundle. Read them only from server code
 * (a future API route, never a 'use client' component).
 *
 * Every credential is optional: an unset/invalid WHATSAPP_PROVIDER falls
 * back to "console" (see lib/services/whatsapp/registry.ts), so the app
 * never fails to build or run just because no vendor is configured yet.
 */

const SUPPORTED_PROVIDER_IDS: readonly WhatsAppProviderId[] = [
  "console",
  "meta-cloud-api",
  "aisensy",
  "interakt",
  "wati",
  "gallabox",
];

function resolveActiveProvider(): WhatsAppProviderId {
  const raw = process.env.WHATSAPP_PROVIDER;
  if (raw && (SUPPORTED_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as WhatsAppProviderId;
  }
  return "console";
}

export const WHATSAPP_ACTIVE_PROVIDER: WhatsAppProviderId = resolveActiveProvider();

export const META_CLOUD_API_CONFIG = {
  phoneNumberId: process.env.WHATSAPP_META_PHONE_NUMBER_ID || "",
  accessToken: process.env.WHATSAPP_META_ACCESS_TOKEN || "",
  apiVersion: process.env.WHATSAPP_META_API_VERSION || "v21.0",
  /** The value configured in the Meta App Dashboard's webhook setup
   *  screen — echoed back by Meta as `hub.verify_token` during the
   *  one-time GET verification handshake. */
  webhookVerifyToken: process.env.WHATSAPP_META_WEBHOOK_VERIFY_TOKEN || "",
  /** The Meta App's secret — used to verify the `X-Hub-Signature-256`
   *  HMAC header on every inbound webhook POST. Not the same as
   *  accessToken (that authenticates outbound calls to Meta; this
   *  authenticates inbound calls from Meta). Also reused, unchanged, by
   *  Module 8.5's embedded-signup code-exchange call below — one Meta
   *  App, one app secret, for both purposes, per Meta's own real
   *  architecture (never a second app secret invented for onboarding). */
  appSecret: process.env.WHATSAPP_META_APP_SECRET || "",
  /** Module 2.3 — the WhatsApp Business Account ID (distinct from
   *  phoneNumberId above): Meta's template-list Graph API endpoint is
   *  scoped to a WABA, not a phone number, since one WABA can own
   *  several phone numbers, each with its own quality rating. This is
   *  this DEPLOYMENT's own default/internal WABA — a tenant's own WABA
   *  id (discovered via Embedded Signup, Module 8.5) is stored per
   *  organization instead, never here. */
  businessAccountId: process.env.WHATSAPP_META_BUSINESS_ACCOUNT_ID || "",
};

/**
 * Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup. PLATFORM-
 * level Meta App configuration, deliberately kept separate from any
 * tenant's own WhatsApp Business credentials (never mixed into the same
 * object as `META_CLOUD_API_CONFIG`'s tenant-resolvable fields above,
 * per the mission's own explicit "keep platform-level Meta application
 * configuration separate from tenant-level WhatsApp Business
 * credentials" instruction). One Meta App, owned by this deployment's
 * operator (the ISV/Tech Provider in Meta's own Embedded Signup
 * terminology), is what every tenant's Embedded Signup flow runs
 * through — `appId` and `configId` are both safe to expose to an
 * authenticated admin's browser (the Facebook JS SDK needs them
 * client-side to render the signup button), unlike `appSecret` above,
 * which the server-side code-exchange call uses but a browser never
 * sees.
 */
export const META_EMBEDDED_SIGNUP_CONFIG = {
  /** The Meta App ID — public by Meta's own design (it appears in the
   *  JS SDK init call and every OAuth redirect URL), safe to serve to
   *  an authenticated admin's browser. */
  appId: process.env.WHATSAPP_META_APP_ID || "",
  /** The Embedded Signup "Configuration ID" created in the Meta App
   *  Dashboard's WhatsApp > Embedded Signup setup screen — selects
   *  which onboarding flow (business verification requirements, asset
   *  permissions requested) the Facebook Login popup runs. Also safe
   *  to serve to the browser (it's a public flow selector, not a
   *  secret). */
  configId: process.env.WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID || "",
  /** Graph API version for the server-side code-exchange and WABA/
   *  phone-discovery calls this module makes — deliberately its own
   *  value rather than silently reusing META_CLOUD_API_CONFIG.apiVersion,
   *  since a deployment operator may want to pin onboarding calls to a
   *  version independently of message-sending calls. Falls back to the
   *  same default. */
  graphApiVersion: process.env.WHATSAPP_META_EMBEDDED_SIGNUP_API_VERSION || process.env.WHATSAPP_META_API_VERSION || "v21.0",
};

/** True only when every value the Embedded Signup flow genuinely needs
 *  to start (App ID + Config ID, client-side; App Secret, server-side
 *  for the code exchange) is actually configured — the one place this
 *  three-way check happens, so a route/UI never has to know the
 *  underlying env var names. */
export function isEmbeddedSignupConfigured(): boolean {
  return Boolean(META_EMBEDDED_SIGNUP_CONFIG.appId && META_EMBEDDED_SIGNUP_CONFIG.configId && META_CLOUD_API_CONFIG.appSecret);
}

export const AISENSY_CONFIG = {
  apiKey: process.env.WHATSAPP_AISENSY_API_KEY || "",
};

export const INTERAKT_CONFIG = {
  apiKey: process.env.WHATSAPP_INTERAKT_API_KEY || "",
};

export const WATI_CONFIG = {
  /** Per-account subdomain, e.g. "https://live-server-123.wati.io" — no trailing slash. */
  apiEndpoint: process.env.WHATSAPP_WATI_API_ENDPOINT || "",
  accessToken: process.env.WHATSAPP_WATI_ACCESS_TOKEN || "",
};

export const GALLABOX_CONFIG = {
  apiKey: process.env.WHATSAPP_GALLABOX_API_KEY || "",
  apiSecret: process.env.WHATSAPP_GALLABOX_API_SECRET || "",
  channelId: process.env.WHATSAPP_GALLABOX_CHANNEL_ID || "",
};
