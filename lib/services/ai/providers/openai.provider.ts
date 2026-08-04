import { OPENAI_CONFIG } from "@/config/aiInsights";
import { getTenantContext } from "@/lib/tenancy/context";
import { AI_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { resolveTenantCredential } from "@/lib/services/integrations/credentialResolver";
import { AiProviderNotConfiguredError } from "../errors";
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from "../types";

/** Real OpenAI Chat Completions API adapter — plain `fetch`, same
 *  posture as anthropic.provider.ts. */
interface OpenAiResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export const openaiProvider: AiProvider = {
  id: "openai",

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    // Business OS Phase 8, Module 8.2 — the current organization's own
    // tenant_secret credential wins over the env-configured key when
    // present; `getTenantContext()` reads the ambient AsyncLocalStorage
    // context every real caller already runs inside (see
    // registry.ts#isAiProviderConfigured's own doc comment for why no
    // organizationId parameter is threaded through this call chain).
    const organizationId = getTenantContext()?.organizationId;
    const apiKey = (organizationId ? await resolveTenantCredential(organizationId, "openai", "apiKey") : undefined) ?? OPENAI_CONFIG.apiKey;
    if (!apiKey) {
      throw new AiProviderNotConfiguredError('OPENAI_API_KEY is blank (AI_PROVIDER="openai")');
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.model,
        max_tokens: request.maxTokens ?? 1024,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
    });

    const body = (await response.json()) as OpenAiResponse;
    if (!response.ok) {
      throw new Error(`OpenAI API error (${response.status}): ${body.error?.message ?? "unknown error"}`);
    }

    const text = body.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI API returned no message content.");
    return { text };
  },
};
