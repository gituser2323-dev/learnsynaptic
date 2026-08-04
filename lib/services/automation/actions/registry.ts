import type { WorkflowActionType } from "../types";
import type { WorkflowActionExecutor } from "./types";
import { sendWhatsAppTemplate } from "./executors/sendWhatsAppTemplate";
import { assignLead } from "./executors/assignLead";
import { addTag } from "./executors/addTag";
import { createTask } from "./executors/createTask";
import { sendEmail } from "./executors/sendEmail";
import { analyzeLeadAi } from "./executors/analyzeLeadAi";
import { analyzeConversationAi } from "./executors/analyzeConversationAi";
import { scheduleMeeting } from "./executors/scheduleMeeting";

/**
 * Provider-registry pattern (WhatsApp providers, 1.3's ScoringProvider)
 * reused for the fourth time, not reinvented — the seam
 * hydrateWorkflowDefinition() (../definitions.ts) resolves every
 * persisted step's WorkflowActionSpec.type against. Adding a fifth
 * action a future workflow needs is a new executor file plus one line
 * here, same shape as adding a WhatsApp vendor adapter.
 */
const actionRegistry: Record<WorkflowActionType, WorkflowActionExecutor> = {
  send_whatsapp_template: sendWhatsAppTemplate,
  assign_lead: assignLead,
  add_tag: addTag,
  create_task: createTask,
  send_email: sendEmail,
  analyze_lead_ai: analyzeLeadAi,
  analyze_conversation_ai: analyzeConversationAi,
  schedule_meeting: scheduleMeeting,
};

export function getActionExecutor(type: WorkflowActionType): WorkflowActionExecutor {
  const executor = actionRegistry[type];
  if (!executor) throw new Error(`Unknown workflow action type: ${type}`);
  return executor;
}
