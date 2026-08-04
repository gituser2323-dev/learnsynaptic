import { EMAIL_ACTIVE_PROVIDER } from "@/config/emailChannel";
import { consoleProvider } from "./providers/console.provider";
import { postmarkProvider } from "./providers/postmark.provider";
import { sendgridProvider } from "./providers/sendgrid.provider";
import { resendProvider } from "./providers/resend.provider";
import type { EmailProvider, EmailProviderId } from "./types";

/**
 * The single seam where a provider id (config, driven by EMAIL_PROVIDER)
 * becomes a concrete EmailProvider instance — the exact same shape
 * lib/services/whatsapp/registry.ts already established. This file is
 * the ONLY place in the app allowed to import a concrete email provider
 * adapter; emailService.ts and everything that calls it depend solely
 * on the EmailProvider interface (types.ts), never on a specific vendor.
 */
const registry: Record<EmailProviderId, EmailProvider> = {
  console: consoleProvider,
  postmark: postmarkProvider,
  sendgrid: sendgridProvider,
  resend: resendProvider,
};

export function getEmailProvider(): EmailProvider {
  return registry[EMAIL_ACTIVE_PROVIDER];
}
