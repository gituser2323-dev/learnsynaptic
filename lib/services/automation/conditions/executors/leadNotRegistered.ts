import type { WorkflowConditionEvaluator } from "../types";

/**
 * Extracted verbatim from the hardcoded lead-nurture-sequence's "offer"
 * step condition — skip if this lead has already registered for a
 * program. Defense in depth alongside triggers.ts's "registration.created
 * stops in-flight runs" rule, against the narrow race where a
 * conversion event fires after the poller already fetched this run but
 * before it finishes the step.
 */
export const leadNotRegistered: WorkflowConditionEvaluator = async (context) => {
  const { getRegistrationRepository } = await import("@/lib/db");
  const repository = await getRegistrationRepository();
  const registrations = await repository.findByLead(context.entityId);
  return registrations.length === 0;
};
