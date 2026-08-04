import { randomUUID } from "crypto";
import { scopeToTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type { CreateMessageAttemptInput, MessageAttempt, MessageAttemptRepository } from "@/lib/services/whatsappCampaigns/types";

const store: MessageAttempt[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryMessageAttemptRepository: MessageAttemptRepository = {
  async create(input: CreateMessageAttemptInput): Promise<MessageAttempt> {
    const attempt: MessageAttempt = stampTenant<MessageAttempt>({
      ...input,
      attemptedAt: nowIso(),
      id: randomUUID(),
      createdAt: nowIso(),
    });
    store.push(attempt);
    return attempt;
  },

  async findByMessage(messageId: string): Promise<MessageAttempt[]> {
    return scopeToTenant(store).filter((a) => a.messageId === messageId).sort((a, b) => a.attemptNumber - b.attemptNumber);
  },
};
