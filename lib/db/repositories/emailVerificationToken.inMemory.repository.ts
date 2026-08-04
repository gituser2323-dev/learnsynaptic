import { randomUUID } from "crypto";
import type { CreateEmailVerificationTokenInput, EmailVerificationToken, EmailVerificationTokenRepository } from "@/lib/services/auth/types";

const store: EmailVerificationToken[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryEmailVerificationTokenRepository: EmailVerificationTokenRepository = {
  async create(input: CreateEmailVerificationTokenInput): Promise<EmailVerificationToken> {
    const token: EmailVerificationToken = { ...input, id: randomUUID(), createdAt: nowIso() };
    store.push(token);
    return token;
  },

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null> {
    return store.find((t) => t.tokenHash === tokenHash) ?? null;
  },

  async markUsed(id: string): Promise<void> {
    const token = store.find((t) => t.id === id);
    if (token) token.usedAt = nowIso();
  },

  async invalidateOutstandingForUser(userId: string): Promise<void> {
    for (const token of store) {
      if (token.userId === userId && !token.usedAt) token.usedAt = nowIso();
    }
  },
};
