import { assignmentService } from "@/lib/services/crm/assignment";
import type { WorkflowActionExecutor } from "../types";

/**
 * One of 3.1's four action targets — reuses assignmentService.assignManually()
 * (1.6's territory) rather than writing a second lead-assignment path.
 * Only meaningful for a Lead-entity run; a workflow triggered against a
 * different entity type with this action configured is a definition
 * authoring mistake, surfaced as a thrown error like any other bad
 * param rather than silently no-op'd.
 */
export const assignLead: WorkflowActionExecutor = async (context, params) => {
  if (context.entityType !== "Lead") {
    throw new Error(`assign_lead action requires a Lead entity, got "${context.entityType}".`);
  }

  const counsellorId = typeof params.counsellorId === "string" ? params.counsellorId : "";
  if (!counsellorId) throw new Error("assign_lead action requires a counsellorId param.");

  await assignmentService.assignManually(context.entityId, counsellorId);
};
