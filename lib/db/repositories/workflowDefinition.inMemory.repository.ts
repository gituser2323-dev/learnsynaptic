import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateWorkflowDefinitionInput,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinitionRecord,
  WorkflowDefinitionRepository,
} from "@/lib/services/automation/types";

const store: WorkflowDefinitionRecord[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryWorkflowDefinitionRepository: WorkflowDefinitionRepository = {
  async create(input: CreateWorkflowDefinitionInput): Promise<WorkflowDefinitionRecord> {
    if (scopeToTenant(store).some((def) => def.id === input.id)) {
      throw new Error(`WorkflowDefinition ${input.id} already exists`);
    }
    const record: WorkflowDefinitionRecord = stampTenant({
      id: input.id,
      name: input.name,
      triggerEventType: input.triggerEventType,
      active: input.active ?? true,
      steps: input.steps,
      organizationId: input.organizationId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(record);
    return record;
  },

  async findById(id: string): Promise<WorkflowDefinitionRecord | null> {
    return findOwnedByTenant(store, (def) => def.id === id) ?? null;
  },

  async list(): Promise<WorkflowDefinitionRecord[]> {
    return scopeToTenant(store).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // Business OS Phase 8, Module 8.1 — this is the automation engine's
  // own trigger-dispatch lookup (triggers.ts), called from inside an
  // in-flight event (e.g. lead.created) whose tenant context IS already
  // established by that point (see engine.ts's own runWithTenantContext
  // wrapping) — scoping here is what makes "trigger automation against
  // another tenant" (mission's own attack list) structurally impossible
  // rather than a convention every future trigger integration must
  // remember.
  async findActiveByTriggerEventType(triggerEventType: string): Promise<WorkflowDefinitionRecord[]> {
    return scopeToTenant(store).filter((def) => def.triggerEventType === triggerEventType && def.active);
  },

  async update(id: string, patch: UpdateWorkflowDefinitionInput): Promise<WorkflowDefinitionRecord> {
    const record = findOwnedByTenant(store, (def) => def.id === id);
    if (!record) throw new Error(`WorkflowDefinition ${id} not found`);
    Object.assign(record, patch, { updatedAt: nowIso() });
    return record;
  },

  async delete(id: string): Promise<void> {
    const record = findOwnedByTenant(store, (def) => def.id === id);
    if (!record) return;
    const index = store.findIndex((def) => def.id === record.id);
    if (index !== -1) store.splice(index, 1);
  },
};
