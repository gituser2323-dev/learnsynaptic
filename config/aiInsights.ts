import type { AiProviderId } from "@/lib/services/ai/types";

/**
 * Single source of truth for AI CRM (Phase 5, module 5.1) provider
 * selection and credentials — server-only, never NEXT_PUBLIC_*, the
 * same shape config/emailChannel.ts and config/whatsapp.ts already
 * established. Unlike Email's EMAIL_PROVIDER (which falls back to a
 * working "console" logger), AI_PROVIDER has no safe default that
 * fabricates an insight — an unset/unrecognized value means AI Lead
 * Insights is simply unavailable (see
 * lib/services/ai/registry.ts#isAiProviderConfigured), never a fake
 * "ai" result.
 */

const SUPPORTED_PROVIDER_IDS: readonly AiProviderId[] = ["openai", "anthropic", "gemini"];

function resolveActiveProvider(): AiProviderId | null {
  const raw = process.env.AI_PROVIDER;
  if (raw && (SUPPORTED_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as AiProviderId;
  }
  return null;
}

export const AI_ACTIVE_PROVIDER: AiProviderId | null = resolveActiveProvider();

export const OPENAI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY || "",
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
};

export const ANTHROPIC_CONFIG = {
  apiKey: process.env.ANTHROPIC_API_KEY || "",
  model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
};

export const GEMINI_CONFIG = {
  apiKey: process.env.GEMINI_API_KEY || "",
  model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
};
