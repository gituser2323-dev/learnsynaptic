export { emailService } from "./emailService";
export { EmailProviderNotImplementedError } from "./errors";
export type {
  EmailRecipient,
  EmailSendPayload,
  EmailSendResult,
  EmailError,
  EmailProviderId,
  EmailInboundMessage,
} from "./types";

// Deliberately NOT exported: getEmailProvider (registry.ts) and every
// concrete adapter. Consumers get emailService and the domain types
// only — reaching for a specific vendor from outside this module is a
// compile-time impossibility, the same guarantee
// lib/services/whatsapp/index.ts already makes for its own module.
