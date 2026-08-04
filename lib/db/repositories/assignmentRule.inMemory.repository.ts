import { randomUUID } from "crypto";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type { AssignmentRule, AssignmentRuleRepository, CreateAssignmentRuleInput } from "@/lib/services/crm/assignment/types";

const store: AssignmentRule[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryAssignmentRuleRepository: AssignmentRuleRepository = {
  async getActive(): Promise<AssignmentRule | null> {
    return scopeToTenant(store).find((r) => r.active) ?? null;
  },

  async create(input: CreateAssignmentRuleInput): Promise<AssignmentRule> {
    for (const rule of scopeToTenant(store)) rule.active = false;
    const rule: AssignmentRule = stampTenant<AssignmentRule>({ ...input, id: randomUUID(), active: true, nextIndex: 0, createdAt: nowIso(), updatedAt: nowIso() });
    store.push(rule);
    return rule;
  },

  async takeNextRoundRobinCounsellor(ruleId: string): Promise<string | null> {
    const rule = findOwnedByTenant(store, (r) => r.id === ruleId);
    if (!rule || rule.counsellorIds.length === 0) return null;
    const currentIndex = rule.nextIndex % rule.counsellorIds.length;
    const counsellorId = rule.counsellorIds[currentIndex];
    rule.nextIndex += 1;
    return counsellorId;
  },
};
