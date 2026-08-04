import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateCustomFieldDefinitionInput,
  CustomFieldDefinition,
  CustomFieldDefinitionRepository,
} from "@/lib/services/crm/customFields/types";

const store: CustomFieldDefinition[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryCustomFieldDefinitionRepository: CustomFieldDefinitionRepository = {
  async findByKey(key: string): Promise<CustomFieldDefinition | null> {
    const lower = key.toLowerCase();
    return scopeToTenant(store).find((f) => f.key === lower) ?? null;
  },

  async create(input: CreateCustomFieldDefinitionInput): Promise<CustomFieldDefinition> {
    const key = input.key.toLowerCase();
    if (scopeToTenant(store).some((f) => f.key === key)) {
      throw new DuplicateKeyError("CustomFieldDefinition", { key });
    }
    const definition: CustomFieldDefinition = stampTenant<CustomFieldDefinition>({
      ...input,
      key,
      required: input.required ?? false,
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(definition);
    return definition;
  },

  async list(): Promise<CustomFieldDefinition[]> {
    return scopeToTenant(store).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async delete(id: string): Promise<void> {
    const definition = findOwnedByTenant(store, (f) => f.id === id);
    if (!definition) return;
    const index = store.findIndex((f) => f.id === id);
    if (index !== -1) store.splice(index, 1);
  },
};
