import { randomUUID } from "crypto";
import type { CreateMfaRecoveryCodeInput, MfaRecoveryCode, MfaRecoveryCodeRepository } from "@/lib/services/auth/types";

const store: MfaRecoveryCode[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryMfaRecoveryCodeRepository: MfaRecoveryCodeRepository = {
  async createMany(inputs: CreateMfaRecoveryCodeInput[]): Promise<MfaRecoveryCode[]> {
    const codes = inputs.map((input) => ({ ...input, id: randomUUID(), createdAt: nowIso() }));
    store.push(...codes);
    return codes;
  },

  async findUnusedByUserId(userId: string): Promise<MfaRecoveryCode[]> {
    return store.filter((c) => c.userId === userId && !c.usedAt);
  },

  async markUsed(id: string): Promise<void> {
    const code = store.find((c) => c.id === id);
    if (code) code.usedAt = nowIso();
  },

  async deleteAllForUser(userId: string): Promise<void> {
    for (let i = store.length - 1; i >= 0; i--) {
      if (store[i]!.userId === userId) store.splice(i, 1);
    }
  },
};
