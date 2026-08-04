import type { AiProviderId } from "./types";

/**
 * Thrown when no AI provider is configured at all (AI_PROVIDER unset or
 * unrecognized) or the selected vendor's own API key env var is blank.
 * Distinct from EmailProviderNotImplementedError/
 * WhatsAppProviderNotImplementedError on purpose: those mark a vendor
 * that's scaffolded but never integrated (a code-completeness gap);
 * every adapter here is a real, working integration — this error means
 * "not configured in this environment," the expected, common case a
 * caller must degrade gracefully from, never a bug to fix in code. See
 * lib/services/crm/scoring/providers/ai.provider.ts for how the
 * `ai` ScoringProvider turns this into an "unavailable" result instead
 * of letting it surface as a crash.
 */
export class AiProviderNotConfiguredError extends Error {
  constructor(reason: string) {
    super(`AI provider is not configured: ${reason}. Set AI_PROVIDER and the matching API key to enable AI Lead Insights.`);
    this.name = "AiProviderNotConfiguredError";
  }
}

export class AiResponseParseError extends Error {
  constructor(providerId: AiProviderId, detail: string) {
    super(`Could not parse a valid insight from the "${providerId}" response: ${detail}`);
    this.name = "AiResponseParseError";
  }
}
