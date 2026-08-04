import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import type { CreateFeatureFlagInput, FeatureFlag, FeatureFlagRepository, UpdateFeatureFlagInput } from "@/lib/services/billing/types";

const store: FeatureFlag[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryFeatureFlagRepository: FeatureFlagRepository = {
  async findByKey(key: string): Promise<FeatureFlag | null> {
    return store.find((f) => f.key === key) ?? null;
  },

  async list(): Promise<FeatureFlag[]> {
    return [...store].sort((a, b) => a.key.localeCompare(b.key));
  },

  async create(input: CreateFeatureFlagInput): Promise<FeatureFlag> {
    if (store.some((f) => f.key === input.key)) throw new DuplicateKeyError("FeatureFlag", { key: input.key });
    const now = nowIso();
    const flag: FeatureFlag = {
      id: randomUUID(),
      key: input.key,
      description: input.description,
      enabled: input.enabled ?? false,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };
    store.push(flag);
    return flag;
  },

  async update(key: string, input: UpdateFeatureFlagInput): Promise<FeatureFlag> {
    const flag = store.find((f) => f.key === key);
    if (!flag) throw new Error(`FeatureFlag "${key}" not found`);
    Object.assign(flag, input, { updatedAt: nowIso() });
    return flag;
  },
};
