import { leadService } from "@/lib/services/leads";
import type { WorkflowActionExecutor } from "../types";

/**
 * One of 3.1's four action targets — reuses leadService.tagLead() (1.3's
 * territory). tagLead() replaces a lead's full tag set, so this executor
 * reads the lead first and merges the new tag in rather than clobbering
 * whatever tags already exist; a step re-running (e.g. after a retry)
 * is naturally idempotent since the merge is a no-op if the tag is
 * already present.
 */
export const addTag: WorkflowActionExecutor = async (context, params) => {
  if (context.entityType !== "Lead") {
    throw new Error(`add_tag action requires a Lead entity, got "${context.entityType}".`);
  }

  const tagId = typeof params.tagId === "string" ? params.tagId : "";
  if (!tagId) throw new Error("add_tag action requires a tagId param.");

  const lead = await leadService.getLead(context.entityId);
  if (!lead) throw new Error(`Lead ${context.entityId} not found.`);

  if (lead.tags?.includes(tagId)) return;

  await leadService.tagLead(context.entityId, [...(lead.tags ?? []), tagId]);
};
