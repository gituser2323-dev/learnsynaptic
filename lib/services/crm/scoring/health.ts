import type { LeadHealth } from "./types";

/**
 * Shared by both ScoringProviders so a lead's health/priority is always
 * a banded read of its own score, never a second value that could drift
 * out of sync — the same principle rulesBased.provider.ts's own doc
 * comment states. The `ai` provider deliberately does NOT trust the
 * model's own subjective "hot/warm/cold" label for this reason; it asks
 * for a numeric score and confidence instead, and this function turns
 * that score into the same three bands rules-based already uses.
 */
export function bandHealth(score: number): LeadHealth {
  return score >= 65 ? "hot" : score >= 35 ? "warm" : "cold";
}
