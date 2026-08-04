import { randomUUID } from "crypto";
import type { CreateRefreshTokenInput, RefreshTokenRecord, RefreshTokenRepository } from "@/lib/services/auth/types";

const store: RefreshTokenRecord[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryRefreshTokenRepository: RefreshTokenRepository = {
  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = {
      ...input,
      id: randomUUID(),
      createdAt: nowIso(),
    };
    store.push(record);
    return record;
  },

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return store.find((r) => r.tokenHash === tokenHash) ?? null;
  },

  async revoke(id: string): Promise<void> {
    const record = store.find((r) => r.id === id);
    if (record) record.revokedAt = nowIso();
  },

  async revokeFamily(familyId: string): Promise<void> {
    for (const record of store) {
      if (record.familyId === familyId && !record.revokedAt) record.revokedAt = nowIso();
    }
  },

  async listByUserId(userId: string): Promise<RefreshTokenRecord[]> {
    return store.filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async revokeAllForUser(userId: string, exceptId?: string): Promise<void> {
    for (const record of store) {
      if (record.userId === userId && !record.revokedAt && record.id !== exceptId) record.revokedAt = nowIso();
    }
  },

  async touchLastUsed(id: string): Promise<void> {
    const record = store.find((r) => r.id === id);
    if (record) record.lastUsedAt = nowIso();
  },
};
