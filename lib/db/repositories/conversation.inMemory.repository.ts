import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  Conversation,
  ConversationChannel,
  ConversationListFilters,
  ConversationRepository,
  CreateConversationInput,
  UpdateConversationInput,
} from "@/lib/services/conversations/types";

const store: Conversation[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryConversationRepository: ConversationRepository = {
  async findById(id: string): Promise<Conversation | null> {
    return findOwnedByTenant(store, (c) => c.id === id) ?? null;
  },

  async findByContact(contactPhoneE164: string, channel: ConversationChannel): Promise<Conversation | null> {
    return scopeToTenant(store).find((c) => c.contactPhoneE164 === contactPhoneE164 && c.channel === channel) ?? null;
  },

  async findByEmailContact(contactEmail: string, channel: ConversationChannel): Promise<Conversation | null> {
    return scopeToTenant(store).find((c) => c.contactEmail === contactEmail && c.channel === channel) ?? null;
  },

  async create(input: CreateConversationInput): Promise<Conversation> {
    const existing = input.contactEmail
      ? await this.findByEmailContact(input.contactEmail, input.channel)
      : await this.findByContact(input.contactPhoneE164 as string, input.channel);
    if (existing) return existing;

    const conversation: Conversation = stampTenant({
      id: randomUUID(),
      channel: input.channel,
      contactPhoneE164: input.contactPhoneE164,
      contactEmail: input.contactEmail,
      contactName: input.contactName,
      leadId: input.leadId,
      status: "open",
      labels: [],
      lastMessageAt: nowIso(),
      unreadCount: 0,
      organizationId: input.organizationId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(conversation);
    return conversation;
  },

  async update(id: string, input: UpdateConversationInput): Promise<Conversation> {
    const conversation = findOwnedByTenant(store, (c) => c.id === id);
    if (!conversation) throw new Error(`Conversation ${id} not found`);
    Object.assign(conversation, input, { updatedAt: nowIso() });
    return conversation;
  },

  async list(
    filters: ConversationListFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Conversation>> {
    let items = scopeToTenant(store);
    if (filters.channel) items = items.filter((c) => c.channel === filters.channel);
    if (filters.status) items = items.filter((c) => c.status === filters.status);
    if (filters.leadId) items = items.filter((c) => c.leadId === filters.leadId);
    if (filters.assignedTo) items = items.filter((c) => c.assignedTo === filters.assignedTo);
    if (filters.label) items = items.filter((c) => c.labels.includes(filters.label as string));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (c) =>
          c.contactName?.toLowerCase().includes(q) ||
          c.contactPhoneE164?.toLowerCase().includes(q) ||
          c.contactEmail?.toLowerCase().includes(q),
      );
    }
    items.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));

    const total = items.length;
    const start = (page - 1) * limit;
    return buildPaginatedResult(items.slice(start, start + limit), total, { page, limit });
  },
};
