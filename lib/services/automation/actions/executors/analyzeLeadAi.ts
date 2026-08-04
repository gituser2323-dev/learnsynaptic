import { leadInsightService } from "@/lib/services/crm/leadInsights";
import type { WorkflowActionExecutor } from "../types";

/**
 * AI CRM (Phase 5), Module 5.1 — "Automatic analysis triggers where
 * appropriate": a workflow step an admin can add to any automation
 * (e.g. the lead nurture sequence) to have a lead AI-analyzed
 * automatically, no counsellor click needed. Reuses
 * leadInsightService.analyzeLead() exactly, the same function "Analyze
 * Again" calls — an automation run is just a second trigger source
 * (trigger: "automation" instead of "manual"), never a parallel
 * analysis path. Deliberately never throws when AI is unavailable or a
 * vendor call fails: leadInsightService already turns either into a
 * persisted "unavailable"/"error" LeadInsight row rather than throwing,
 * so a step running in a WorkflowRun degrades the same way the UI does
 * — it never fails the whole automation run over a missing AI key.
 */
export const analyzeLeadAi: WorkflowActionExecutor = async (context) => {
  if (context.entityType !== "Lead") {
    throw new Error(`analyze_lead_ai action requires a Lead entity, got "${context.entityType}".`);
  }

  await leadInsightService.analyzeLead(context.entityId, { trigger: "automation" });
};
