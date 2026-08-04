/**
 * AI CRM (Phase 5) — vendor abstraction. Deliberately separate from
 * ScoringProvider (lib/services/crm/scoring), which is the *domain*
 * seam (rules-based vs. ai) established in Phase 1. This is the
 * *vendor* seam beneath it — the same two-layer split WhatsApp already
 * has (whatsappService -> WhatsAppProvider -> aisensy/interakt/wati/
 * gallabox) and Email now has (emailService -> EmailProvider ->
 * postmark/sendgrid/resend). Only the Module 5.1 `ai` ScoringProvider
 * calls this; nothing else in the app should import a concrete adapter
 * directly (see registry.ts).
 */

export type AiProviderId = "openai" | "anthropic" | "gemini";

export interface AiCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  /** Vendor-appropriate default supplied by each adapter if omitted. */
  maxTokens?: number;
}

export interface AiCompletionResult {
  text: string;
}

export interface AiProvider {
  readonly id: AiProviderId;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
