import { randomUUID } from "crypto";
import type { BrandConfiguration, BrandConfigurationRepository, UpsertBrandConfigurationInput } from "@/lib/services/branding/types";

const store: BrandConfiguration[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryBrandConfigurationRepository: BrandConfigurationRepository = {
  async findByOrganizationId(organizationId: string): Promise<BrandConfiguration | null> {
    return store.find((b) => b.organizationId === organizationId) ?? null;
  },

  async upsert(organizationId: string, input: UpsertBrandConfigurationInput): Promise<BrandConfiguration> {
    const existing = store.find((b) => b.organizationId === organizationId);
    if (existing) {
      const mutable = existing as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(input)) {
        if (value === null) delete mutable[key];
        else if (value !== undefined) mutable[key] = value;
      }
      existing.updatedAt = nowIso();
      return existing;
    }
    const now = nowIso();
    const config: BrandConfiguration = { id: randomUUID(), organizationId, createdAt: now, updatedAt: now };
    const mutableConfig = config as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(input)) {
      if (value !== null && value !== undefined) mutableConfig[key] = value;
    }
    store.push(config);
    return config;
  },

  async deleteByOrganizationId(organizationId: string): Promise<void> {
    const index = store.findIndex((b) => b.organizationId === organizationId);
    if (index >= 0) store.splice(index, 1);
  },
};
