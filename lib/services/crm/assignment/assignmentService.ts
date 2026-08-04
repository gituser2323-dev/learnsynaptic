import { getAssignmentRuleRepository, getLeadRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { activityService } from "@/lib/services/crm/activities";
import { publish } from "@/lib/events";
import type { AuditContext } from "@/lib/services/auditLog";
import type { AssignmentRule, CreateAssignmentRuleInput } from "./types";

export const assignmentService = {
  async getActiveRule(): Promise<AssignmentRule | null> {
    const repository = await getAssignmentRuleRepository();
    return repository.getActive();
  },

  async setRule(input: CreateAssignmentRuleInput): Promise<AssignmentRule> {
    const repository = await getAssignmentRuleRepository();
    return repository.create(input);
  },

  /** Called from leadService.registerLead() right after a genuinely new
   *  lead is created — a no-op (returns null) if no active rule exists
   *  or the active rule is "manual" (manual means a human assigns,
   *  never automatic). Not audited on its own: lead.assigned (below)
   *  covers this same call's business meaning whether it happened
   *  automatically or by hand — one action name, one audit entry,
   *  regardless of trigger. */
  async autoAssignOnCreate(leadId: string): Promise<string | null> {
    const rule = await this.getActiveRule();
    if (!rule || rule.strategy !== "round_robin" || rule.counsellorIds.length === 0) return null;

    const ruleRepository = await getAssignmentRuleRepository();
    const counsellorId = await ruleRepository.takeNextRoundRobinCounsellor(rule.id);
    if (!counsellorId) return null;

    const leadRepository = await getLeadRepository();
    await leadRepository.update(leadId, { assignedCounsellorId: counsellorId });
    await auditLogService.record({
      action: AUDIT_ACTIONS.LEAD_ASSIGNED,
      entityType: "Lead",
      entityId: leadId,
      metadata: { assignedCounsellorId: counsellorId, strategy: "round_robin" },
    });
    await activityService.logSystemEvent("Lead", leadId, "Automatically assigned via round robin");
    await publish("lead.assigned", { leadId, assignedCounsellorId: counsellorId, strategy: "round_robin" });
    return counsellorId;
  },

  async assignManually(leadId: string, counsellorId: string, context: AuditContext = {}): Promise<void> {
    const leadRepository = await getLeadRepository();
    const existing = await leadRepository.findById(leadId);
    if (!existing) throw new Error(`Lead ${leadId} not found`);

    const isReassignment = Boolean(existing.assignedCounsellorId);
    await leadRepository.update(leadId, { assignedCounsellorId: counsellorId });

    await auditLogService.record({
      action: isReassignment ? AUDIT_ACTIONS.LEAD_REASSIGNED : AUDIT_ACTIONS.LEAD_ASSIGNED,
      entityType: "Lead",
      entityId: leadId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { assignedCounsellorId: counsellorId, previousCounsellorId: existing.assignedCounsellorId },
    });
    await activityService.logSystemEvent(
      "Lead",
      leadId,
      isReassignment ? `Reassigned to a different counsellor` : `Assigned to a counsellor`,
    );
    await publish("lead.assigned", {
      leadId,
      assignedCounsellorId: counsellorId,
      previousCounsellorId: existing.assignedCounsellorId,
      isReassignment,
    });
  },
};
