import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateMessageInput,
  Message,
  MessageListFilters,
  MessageRepository,
  MessageStatusCounts,
} from "@/lib/services/whatsappCampaigns/types";

const store: Message[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function toMessage(input: CreateMessageInput): Message {
  return stampTenant<Message>({
    ...input,
    status: "queued",
    attempts: 0,
    queuedAt: nowIso(),
    id: randomUUID(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export const inMemoryMessageRepository: MessageRepository = {
  async create(input: CreateMessageInput): Promise<Message> {
    const message = toMessage(input);
    store.push(message);
    return message;
  },

  async createMany(inputs: CreateMessageInput[]): Promise<Message[]> {
    const messages = inputs.map(toMessage);
    store.push(...messages);
    return messages;
  },

  async findById(id: string): Promise<Message | null> {
    return findOwnedByTenant(store, (m) => m.id === id) ?? null;
  },

  async findByProviderMessageId(providerMessageId: string): Promise<Message | null> {
    return scopeToTenant(store).find((m) => m.providerMessageId === providerMessageId) ?? null;
  },

  async findLatestOutboundCampaignMessage(recipientPhoneE164: string): Promise<Message | null> {
    const matches = scopeToTenant(store)
      .filter((m) => m.recipientPhoneE164 === recipientPhoneE164 && m.campaignId && m.direction !== "inbound")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] ?? null;
  },

  async list(filters: MessageListFilters, page: number, limit: number): Promise<PaginatedResult<Message>> {
    let results = scopeToTenant(store);
    if (filters.campaignId) results = results.filter((m) => m.campaignId === filters.campaignId);
    if (filters.status) results = results.filter((m) => m.status === filters.status);
    if (filters.conversationId) results = results.filter((m) => m.conversationId === filters.conversationId);
    if (filters.workflowRunId) results = results.filter((m) => m.workflowRunId === filters.workflowRunId);
    else if (filters.hasWorkflowRunId) results = results.filter((m) => !!m.workflowRunId);
    if (filters.leadId) results = results.filter((m) => m.leadId === filters.leadId);
    if (filters.createdAfter) results = results.filter((m) => m.createdAt >= filters.createdAfter!);
    if (filters.createdBefore) results = results.filter((m) => m.createdAt <= filters.createdBefore!);
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async update(id, patch): Promise<Message> {
    const message = findOwnedByTenant(store, (m) => m.id === id);
    if (!message) throw new Error(`Message ${id} not found`);
    Object.assign(message, patch, { updatedAt: nowIso() });
    return message;
  },

  async countByStatus(campaignId?: string): Promise<MessageStatusCounts> {
    const counts: MessageStatusCounts = { queued: 0, sending: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const message of scopeToTenant(store)) {
      if (campaignId === undefined || message.campaignId === campaignId) counts[message.status] += 1;
    }
    return counts;
  },

  async findFailedByCampaign(campaignId: string): Promise<Message[]> {
    return scopeToTenant(store).filter((m) => m.campaignId === campaignId && m.status === "failed");
  },
};
