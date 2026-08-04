/**
 * Shared by every feature that asks a model for strict JSON (5.1's Lead
 * Insights, 5.2's Reply Assistant) — models occasionally wrap JSON in a
 * ```json fence despite an explicit system-prompt instruction not to.
 * Stripping it defensively here, once, avoids each new AI feature
 * re-implementing the same cosmetic-deviation workaround.
 */
export function stripJsonFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
}
