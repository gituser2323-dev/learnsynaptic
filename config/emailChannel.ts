import type { EmailProviderId } from "@/lib/services/email/types";

/**
 * Single source of truth for Email Channel (Communication Center,
 * Phase 4, module 4.2) provider selection and credentials. NOT the same
 * file as config/email.ts — that one is the pre-existing, unrelated,
 * client-side @emailjs/browser wrapper the AI Bootcamp registration
 * form uses (NEXT_PUBLIC_* by design, browser SDK). This file is the
 * exact server-only counterpart to config/whatsapp.ts, one module
 * earlier: never NEXT_PUBLIC_*, read only from server code.
 *
 * Every credential is optional: an unset/invalid EMAIL_PROVIDER falls
 * back to "console" (see lib/services/email/registry.ts), so the app
 * never fails to build or run just because no vendor is configured yet
 * — same posture WhatsApp's own config has taken since Phase 2.
 */

const SUPPORTED_PROVIDER_IDS: readonly EmailProviderId[] = ["console", "postmark", "sendgrid", "resend"];

function resolveActiveProvider(): EmailProviderId {
  const raw = process.env.EMAIL_PROVIDER;
  if (raw && (SUPPORTED_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as EmailProviderId;
  }
  return "console";
}

export const EMAIL_ACTIVE_PROVIDER: EmailProviderId = resolveActiveProvider();

export const POSTMARK_CONFIG = {
  serverToken: process.env.EMAIL_POSTMARK_SERVER_TOKEN || "",
  /** The "from" address Postmark sends as — must be a verified Sender
   *  Signature or domain in the Postmark account. */
  fromAddress: process.env.EMAIL_POSTMARK_FROM_ADDRESS || "",
  /** A shared secret this app expects as a `?token=` query param on the
   *  inbound webhook URL configured in Postmark's Inbound Stream
   *  settings — Postmark's inbound webhooks aren't HMAC-signed by
   *  default, so a URL-embedded secret is the standard way to verify
   *  the request actually came from Postmark and not an open endpoint.
   *  See app/api/webhooks/email/route.ts. */
  inboundWebhookToken: process.env.EMAIL_POSTMARK_INBOUND_TOKEN || "",
};

export const SENDGRID_CONFIG = {
  apiKey: process.env.EMAIL_SENDGRID_API_KEY || "",
};

export const RESEND_CONFIG = {
  apiKey: process.env.EMAIL_RESEND_API_KEY || "",
};
