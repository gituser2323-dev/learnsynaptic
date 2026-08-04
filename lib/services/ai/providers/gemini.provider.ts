import { GEMINI_CONFIG } from "@/config/aiInsights";
import { getTenantContext } from "@/lib/tenancy/context";
import { AI_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { resolveTenantCredential } from "@/lib/services/integrations/credentialResolver";
import { AiProviderNotConfiguredError } from "../errors";
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from "../types";

/** Real Google Gemini generateContent API adapter — plain `fetch`, same
 *  posture as anthropic.provider.ts. Gemini has no separate "system"
 *  role in this endpoint; systemPrompt is passed via systemInstruction. */
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export const geminiProvider: AiProvider = {
  id: "gemini",

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    // Business OS Phase 8, Module 8.2 — see openai.provider.ts's own
    // doc comment on this exact pattern.
    const organizationId = getTenantContext()?.organizationId;
    const apiKey = (organizationId ? await resolveTenantCredential(organizationId, "gemini", "apiKey") : undefined) ?? GEMINI_CONFIG.apiKey;
    if (!apiKey) {
      throw new AiProviderNotConfiguredError('GEMINI_API_KEY is blank (AI_PROVIDER="gemini")');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
        generationConfig: { maxOutputTokens: request.maxTokens ?? 1024 },
      }),
      signal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
    });

    const body = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw new Error(`Gemini API error (${response.status}): ${body.error?.message ?? "unknown error"}`);
    }

    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new Error("Gemini API returned no candidate content.");
    return { text };
  },
};
