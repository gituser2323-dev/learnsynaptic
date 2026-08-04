import { randomUUID } from "crypto";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  AutoReplyRule,
  AutoReplyRuleRepository,
  CreateAutoReplyRuleInput,
  UpdateAutoReplyRuleInput,
} from "@/lib/services/automation/autoReply/types";

const store: AutoReplyRule[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryAutoReplyRuleRepository: AutoReplyRuleRepository = {
  async create(input: CreateAutoReplyRuleInput): Promise<AutoReplyRule> {
    const rule: AutoReplyRule = stampTenant<AutoReplyRule>({
      id: randomUUID(),
      keywords: input.keywords,
      replyText: input.replyText,
      isFallback: input.isFallback ?? false,
      active: input.active ?? true,
      organizationId: input.organizationId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(rule);
    return rule;
  },

  async findById(id: string): Promise<AutoReplyRule | null> {
    return findOwnedByTenant(store, (rule) => rule.id === id) ?? null;
  },

  async list(): Promise<AutoReplyRule[]> {
    return scopeToTenant(store).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async listActive(): Promise<AutoReplyRule[]> {
    return scopeToTenant(store)
      .filter((rule) => rule.active)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async update(id: string, patch: UpdateAutoReplyRuleInput): Promise<AutoReplyRule> {
    const rule = findOwnedByTenant(store, (r) => r.id === id);
    if (!rule) throw new Error(`AutoReplyRule ${id} not found`);
    Object.assign(rule, patch, { updatedAt: nowIso() });
    return rule;
  },

  async delete(id: string): Promise<void> {
    const rule = findOwnedByTenant(store, (r) => r.id === id);
    if (!rule) return;
    const index = store.findIndex((r) => r.id === id);
    if (index !== -1) store.splice(index, 1);
  },
};
