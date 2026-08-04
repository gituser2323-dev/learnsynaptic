import { randomUUID } from "crypto";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type { CreatePipelineInput, Pipeline, PipelineRepository } from "@/lib/services/crm/pipelines/types";

const store: Pipeline[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryPipelineRepository: PipelineRepository = {
  async findById(id: string): Promise<Pipeline | null> {
    return findOwnedByTenant(store, (p) => p.id === id) ?? null;
  },

  async getDefault(): Promise<Pipeline | null> {
    return scopeToTenant(store).find((p) => p.isDefault) ?? null;
  },

  async create(input: CreatePipelineInput): Promise<Pipeline> {
    const pipeline: Pipeline = stampTenant<Pipeline>({
      id: randomUUID(),
      name: input.name,
      isDefault: input.isDefault ?? false,
      program: input.program,
      stages: input.stages.map((s, index) => ({
        id: randomUUID(),
        name: s.name,
        order: index,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
      })),
      organizationId: input.organizationId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(pipeline);
    return pipeline;
  },

  async list(): Promise<Pipeline[]> {
    return scopeToTenant(store).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async delete(id: string): Promise<void> {
    const pipeline = findOwnedByTenant(store, (p) => p.id === id);
    if (!pipeline) return;
    const index = store.findIndex((p) => p.id === id);
    if (index !== -1) store.splice(index, 1);
  },
};
