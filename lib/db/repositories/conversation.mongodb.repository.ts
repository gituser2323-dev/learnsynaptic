import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { ConversationModel, toConversation } from "@/lib/db/models/conversation.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  Conversation,
  ConversationChannel,
  ConversationListFilters,
  ConversationRepository,
  CreateConversationInput,
  UpdateConversationInput,
} from "@/lib/services/conversations/types";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildQuery(filters: ConversationListFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.channel) query.channel = filters.channel;
  if (filters.status) query.status = filters.status;
  if (filters.assignedTo) query.assignedTo = filters.assignedTo;
  if (filters.label) query.labels = filters.label;
  if (filters.leadId) query.leadId = filters.leadId;
  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), "i");
    query.$or = [{ contactName: regex }, { contactPhoneE164: regex }, { contactEmail: regex }];
  }
  return query;
}

export const mongodbConversationRepository: ConversationRepository = {
  async findById(id: string): Promise<Conversation | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await ConversationModel.findById(id).exec();
    return doc ? toConversation(doc) : null;
  },

  async findByContact(contactPhoneE164: string, channel: ConversationChannel): Promise<Conversation | null> {
    await getConnection();
    const doc = await ConversationModel.findOne({ contactPhoneE164, channel }).exec();
    return doc ? toConversation(doc) : null;
  },

  async findByEmailContact(contactEmail: string, channel: ConversationChannel): Promise<Conversation | null> {
    await getConnection();
    const doc = await ConversationModel.findOne({ contactEmail, channel }).exec();
    return doc ? toConversation(doc) : null;
  },

  async create(input: CreateConversationInput): Promise<Conversation> {
    await getConnection();
    // Race-safe: two inbound messages arriving concurrently for a brand
    // new contact must never create two Conversation rows — the same
    // "unique index + upsert" shape organizationService's
    // ensureDefaultOrganization() already uses for exactly this reason.
    // Module 4.2 — the upsert filter keys on whichever identity field
    // this input actually carries (contactPhoneE164 for WhatsApp,
    // contactEmail for email), matching the sparse unique index that
    // now exists for each.
    const identityFilter = input.contactEmail
      ? { contactEmail: input.contactEmail, channel: input.channel }
      : { contactPhoneE164: input.contactPhoneE164, channel: input.channel };
    const doc = await ConversationModel.findOneAndUpdate(
      identityFilter,
      { $setOnInsert: { ...input, status: "open", labels: [], lastMessageAt: new Date(), unreadCount: 0 } },
      { upsert: true, new: true },
    ).exec();
    return toConversation(doc);
  },

  async update(id: string, input: UpdateConversationInput): Promise<Conversation> {
    await getConnection();
    const update: Record<string, unknown> = { ...input };
    if (input.lastMessageAt) update.lastMessageAt = new Date(input.lastMessageAt);
    const doc = await ConversationModel.findByIdAndUpdate(id, update, { new: true }).exec();
    if (!doc) throw new Error(`Conversation ${id} not found`);
    return toConversation(doc);
  },

  async list(
    filters: ConversationListFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Conversation>> {
    await getConnection();
    const query = buildQuery(filters);
    const [docs, total] = await Promise.all([
      ConversationModel.find(query)
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      ConversationModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toConversation), total, { page, limit });
  },
};
