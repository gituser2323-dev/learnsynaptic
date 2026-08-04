import { ANTHROPIC_CONFIG } from "@/config/aiInsights";
import { getTenantContext } from "@/lib/tenancy/context";
import { AI_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { resolveTenantCredential } from "@/lib/services/integrations/credentialResolver";
import { AiProviderNotConfiguredError } from "../errors";
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from "../types";

/**
 * Real Anthropic Messages API adapter — plain `fetch`, no SDK dependency,
 * the same posture every other vendor adapter in this codebase takes
 * (WhatsApp's Meta Graph API calls, Postmark's email calls). Verify
 * against Anthropic's current API docs before relying on this in
 * production, the same disclosed caveat 2.3's Meta Graph API adapter
 * carries for its own response-shape assumptions.
 */
interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

export const anthropicProvider: AiProvider = {
  id: "anthropic",

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    // Business OS Phase 8, Module 8.2 — see openai.provider.ts's own
    // doc comment on this exact pattern.
    const organizationId = getTenantContext()?.organizationId;
    const apiKey = (organizationId ? await resolveTenantCredential(organizationId, "anthropic", "apiKey") : undefined) ?? ANTHROPIC_CONFIG.apiKey;
    if (!apiKey) {
      throw new AiProviderNotConfiguredError('ANTHROPIC_API_KEY is blank (AI_PROVIDER="anthropic")');
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_CONFIG.model,
        max_tokens: request.maxTokens ?? 1024,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userPrompt }],
      }),
      signal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
    });

    const body = (await response.json()) as AnthropicResponse;
    if (!response.ok) {
      throw new Error(`Anthropic API error (${response.status}): ${body.error?.message ?? "unknown error"}`);
    }

    const text = body.content?.find((block) => block.type === "text")?.text;
    if (!text) throw new Error("Anthropic API returned no text content.");
    return { text };
  },
};
