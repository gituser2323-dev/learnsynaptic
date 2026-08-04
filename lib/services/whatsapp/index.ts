export { whatsappService } from "./whatsappService";
export { WhatsAppProviderNotImplementedError } from "./errors";
// Module 2.3 — bootstrap.ts's own wiring point, same pattern as
// automation's registerAutomationTickHandler/ensureAutomationTickScheduled.
export { registerTemplateSyncHandler, registerPhoneHealthCheckHandler, ensureWhatsAppHealthTicksScheduled } from "./schedulerIntegration";
// Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup. Same
// "service + domain types only" export discipline as the rest of this
// barrel — embeddedSignup's own internal Meta Graph client stays
// unreachable from outside this module, exactly like every concrete
// WhatsAppProvider adapter already is.
export { embeddedSignupService, EmbeddedSignupError } from "./embeddedSignup";
export type {
  EmbeddedSignupClientResult,
  WhatsAppConnectionState,
  WhatsAppConnectionSummary,
  EmbeddedSignupErrorCode,
} from "./embeddedSignup";
export type {
  WhatsAppRecipient,
  WhatsAppTemplatePayload,
  WhatsAppSendResult,
  WhatsAppError,
  WhatsAppProviderId,
  WhatsAppWebhookChallenge,
  WhatsAppWebhookEvent,
  WhatsAppWebhookEventType,
  WhatsAppInboundMessage,
  MessageContentType,
  WhatsAppQuickReplyButton,
  WhatsAppInteractiveButtonsPayload,
  WhatsAppListRow,
  WhatsAppListSection,
  WhatsAppInteractiveListPayload,
  WhatsAppMediaKind,
  WhatsAppMediaPayload,
  WhatsAppResolvedMedia,
  WhatsAppTemplateApprovalStatus,
  WhatsAppPhoneNumberHealth,
} from "./types";

// Deliberately NOT exported: getWhatsAppProvider (registry.ts), every
// concrete adapter, and queue.ts's processSendJob. Consumers get
// whatsappService and the domain types only — reaching for a specific
// vendor from outside this module is a compile-time impossibility, not
// just a convention.
