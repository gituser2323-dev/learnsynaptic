import { rulesBasedScoringProvider } from "./providers/rulesBased.provider";
import { aiScoringProvider } from "./providers/ai.provider";
import type { ScoringProvider } from "./types";

/** Same seam as lib/services/whatsapp/registry.ts — the only file
 *  allowed to select a concrete provider. AI CRM (Phase 5, module 5.1)
 *  registers its `ai` provider here, never a new scoring path elsewhere. */
const providers: Record<string, ScoringProvider> = {
  "rules-based": rulesBasedScoringProvider,
  ai: aiScoringProvider,
};

export function getScoringProvider(id: string = "rules-based"): ScoringProvider {
  return providers[id] ?? providers["rules-based"];
}
