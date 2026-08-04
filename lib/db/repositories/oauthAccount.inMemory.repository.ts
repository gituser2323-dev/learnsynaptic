import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import type { CreateOAuthAccountInput, OAuthAccount, OAuthAccountRepository, OAuthProviderId } from "@/lib/services/auth/types";

const store: OAuthAccount[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryOAuthAccountRepository: OAuthAccountRepository = {
  async create(input: CreateOAuthAccountInput): Promise<OAuthAccount> {
    if (store.some((a) => a.provider === input.provider && a.providerAccountId === input.providerAccountId)) {
      throw new DuplicateKeyError("OAuthAccount", { provider: input.provider, providerAccountId: input.providerAccountId });
    }
    const account: OAuthAccount = { ...input, id: randomUUID(), createdAt: nowIso() };
    store.push(account);
    return account;
  },

  async findByProviderAccount(provider: OAuthProviderId, providerAccountId: string): Promise<OAuthAccount | null> {
    return store.find((a) => a.provider === provider && a.providerAccountId === providerAccountId) ?? null;
  },

  async listByUserId(userId: string): Promise<OAuthAccount[]> {
    return store.filter((a) => a.userId === userId);
  },

  async delete(id: string): Promise<void> {
    const index = store.findIndex((a) => a.id === id);
    if (index !== -1) store.splice(index, 1);
  },
};
