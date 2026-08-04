import { getConversationRepository } from "@/lib/db";
import { conversationInsightService } from "@/lib/services/conversations/insights";
import type { WorkflowActionExecutor } from "../types";

/**
 * AI CRM (Phase 5), Module 5.3 — "reuse Workflow Automation." The
 * WorkflowRun engine only ever runs against Lead entities today (see
 * lib/services/automation/triggers.ts's hardcoded `"Lead"` — no
 * Conversation-scoped workflow trigger exists), so this step resolves
 * the lead's own most-recently-active conversation (via the `leadId`
 * filter 5.1 added to ConversationListFilters) and analyzes that one.
 * A lead with no conversation yet is a normal, common case — this
 * no-ops rather than throwing, the same "don't fail a healthy
 * WorkflowRun over a step that legitimately has nothing to do"
 * posture analyzeLeadAi.ts already established for its own no-AI-
 * configured case.
 */
export const analyzeConversationAi: WorkflowActionExecutor = async (context) => {
  if (context.entityType !== "Lead") {
    throw new Error(`analyze_conversation_ai action requires a Lead entity, got "${context.entityType}".`);
  }

  const conversationRepository = await getConversationRepository();
  const page = await conversationRepository.list({ leadId: context.entityId }, 1, 1);
  const conversation = page.items[0];
  if (!conversation) return;

  await conversationInsightService.analyzeConversation(conversation.id, { trigger: "automation" });
};
