import { AI_ACTIVE_PROVIDER, OPENAI_CONFIG, ANTHROPIC_CONFIG, GEMINI_CONFIG } from "@/config/aiInsights";
import { getTenantContext } from "@/lib/tenancy/context";
import { resolveTenantCredential } from "@/lib/services/integrations/credentialResolver";
import { entitlementService, usageService } from "@/lib/services/billing";
import { openaiProvider } from "./providers/openai.provider";
import { anthropicProvider } from "./providers/anthropic.provider";
import { geminiProvider } from "./providers/gemini.provider";
import { AiProviderNotConfiguredError } from "./errors";
import type { AiCompletionRequest, AiCompletionResult, AiProvider, AiProviderId } from "./types";

/**
 * The single seam where AI_PROVIDER becomes a concrete AiProvider
 * instance — the exact shape lib/services/whatsapp/registry.ts and
 * lib/services/email/registry.ts already established. Only
 * lib/services/crm/scoring/providers/ai.provider.ts is meant to call
 * this; nothing else should import a concrete adapter directly.
 */
const registry: Record<AiProviderId, AiProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
};

const API_KEY_BY_PROVIDER: Record<AiProviderId, string> = {
  openai: OPENAI_CONFIG.apiKey,
  anthropic: ANTHROPIC_CONFIG.apiKey,
  gemini: GEMINI_CONFIG.apiKey,
};

/**
 * True only when AI_PROVIDER names a supported vendor AND an API key is
 * available for it — the one check lib/services/crm/scoring/providers/
 * ai.provider.ts (and the two Conversation AI callers) need to decide
 * "fail gracefully" vs. "actually call the model" without needing a
 * try/catch around every call site.
 *
 * Business OS Phase 8, Module 8.2 — now async: checks the CURRENT
 * organization's own tenant_secret credential (credentialResolver.ts)
 * before falling back to the env-configured key, the same "tenant
 * first, env fallback" precedence every provider adapter in this
 * module now follows. `getTenantContext()` reads the ambient
 * AsyncLocalStorage context Module 8.1's `withApiRoute`/background-job
 * wrapping already establishes — this function doesn't receive
 * organizationId as an argument (unlike credentialResolver.ts's own
 * functions, which always do) specifically because every real caller
 * of this function already runs inside that ambient context; there is
 * no other organizationId a caller could meaningfully supply here.
 */
export async function isAiProviderConfigured(): Promise<boolean> {
  if (!AI_ACTIVE_PROVIDER) return false;
  if (API_KEY_BY_PROVIDER[AI_ACTIVE_PROVIDER].length > 0) return true;

  const organizationId = getTenantContext()?.organizationId;
  if (!organizationId) return false;
  const tenantKey = await resolveTenantCredential(organizationId, AI_ACTIVE_PROVIDER, "apiKey");
  return !!tenantKey;
}

/**
 * Business OS Phase 8, Module 8.3 — meters every AI call and enforces
 * the organization's own plan (`ai_crm` capability + `ai_requests`
 * usage limit) at this ONE seam, so all three real callers
 * (lead scoring/insights, AI-assisted replies, conversational
 * analytics) get real server-side enforcement without each needing its
 * own check — the mission's own explicit "avoid feature-check logic
 * scattered throughout the application." Checked/incremented BEFORE
 * the real vendor call, so a denied request never reaches (and is
 * never billed by) the vendor — "do not partially execute paid
 * actions." Meters by REQUEST COUNT only, not tokens: none of this
 * app's three vendor adapters (openai/anthropic/gemini
 * .provider.ts) currently parse the vendor's own usage/token fields
 * from the response, and the mission's own explicit "do NOT invent
 * token/cost numbers when providers do not return them" rules out
 * fabricating a per-token figure — a real, disclosed follow-up for
 * token-level accounting, not simulated here.
 */
function meteredProvider(inner: AiProvider): AiProvider {
  return {
    id: inner.id,
    async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
      const organizationId = getTenantContext()?.organizationId;
      if (organizationId) {
        await entitlementService.assertCapability(organizationId, "ai_crm");
        await usageService.assertWithinLimit(organizationId, "ai_requests");
      }
      return inner.complete(request);
    },
  };
}

export function getAiProvider(): AiProvider {
  if (!AI_ACTIVE_PROVIDER) {
    throw new AiProviderNotConfiguredError("AI_PROVIDER is unset or not one of openai|anthropic|gemini");
  }
  return meteredProvider(registry[AI_ACTIVE_PROVIDER]);
}
