import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type { CreateTagInput, Tag, TagRepository } from "@/lib/services/crm/tags/types";

const store: Tag[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryTagRepository: TagRepository = {
  async findById(id: string): Promise<Tag | null> {
    return findOwnedByTenant(store, (t) => t.id === id) ?? null;
  },

  async findByIds(ids: string[]): Promise<Tag[]> {
    return scopeToTenant(store).filter((t) => ids.includes(t.id));
  },

  async create(input: CreateTagInput): Promise<Tag> {
    if (scopeToTenant(store).some((t) => t.label.toLowerCase() === input.label.toLowerCase())) {
      throw new DuplicateKeyError("Tag", { label: input.label });
    }
    const tag: Tag = stampTenant<Tag>({ ...input, id: randomUUID(), createdAt: nowIso(), updatedAt: nowIso() });
    store.push(tag);
    return tag;
  },

  async list(): Promise<Tag[]> {
    return scopeToTenant(store).sort((a, b) => a.label.localeCompare(b.label));
  },

  async delete(id: string): Promise<void> {
    const tag = findOwnedByTenant(store, (t) => t.id === id);
    if (!tag) return;
    const index = store.findIndex((t) => t.id === id);
    if (index !== -1) store.splice(index, 1);
  },
};
