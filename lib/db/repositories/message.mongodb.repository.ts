import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { MessageModel, toMessage, type MessageDocument } from "@/lib/db/models/message.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateMessageInput,
  Message,
  MessageListFilters,
  MessageRepository,
  MessageStatusCounts,
} from "@/lib/services/whatsappCampaigns/types";

const ALL_STATUSES: (keyof MessageStatusCounts)[] = ["queued", "sending", "sent", "delivered", "read", "failed"];

export const mongodbMessageRepository: MessageRepository = {
  async create(input: CreateMessageInput): Promise<Message> {
    await getConnection();
    const doc = await MessageModel.create({ ...input, queuedAt: new Date() });
    return toMessage(doc);
  },

  async createMany(inputs: CreateMessageInput[]): Promise<Message[]> {
    await getConnection();
    // insertMany's own inferred parameter type is stricter than the
    // plain input shape here (it wants ObjectId-typed refs where these
    // are still plain strings pre-cast, same as every other model's
    // .create() calls) — the runtime documents are identical either
    // way, this cast only affects what TS checks at the call site.
    const docs = (await MessageModel.insertMany(
      inputs.map((input) => ({ ...input, queuedAt: new Date() })) as unknown as Partial<MessageDocument>[],
    )) as unknown as MessageDocument[];
    return docs.map(toMessage);
  },

  async findById(id: string): Promise<Message | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await MessageModel.findById(id).exec();
    return doc ? toMessage(doc) : null;
  },

  async findByProviderMessageId(providerMessageId: string): Promise<Message | null> {
    await getConnection();
    const doc = await MessageModel.findOne({ providerMessageId }).exec();
    return doc ? toMessage(doc) : null;
  },

  async findLatestOutboundCampaignMessage(recipientPhoneE164: string): Promise<Message | null> {
    await getConnection();
    const doc = await MessageModel.findOne({
      recipientPhoneE164,
      campaignId: { $ne: null },
      direction: { $ne: "inbound" },
    })
      .sort({ createdAt: -1 })
      .exec();
    return doc ? toMessage(doc) : null;
  },

  async list(filters: MessageListFilters, page: number, limit: number): Promise<PaginatedResult<Message>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.campaignId) query.campaignId = filters.campaignId;
    if (filters.status) query.status = filters.status;
    if (filters.conversationId) query.conversationId = filters.conversationId;
    if (filters.workflowRunId) query.workflowRunId = filters.workflowRunId;
    else if (filters.hasWorkflowRunId) query.workflowRunId = { $exists: true, $ne: null };
    if (filters.leadId) query.leadId = filters.leadId;
    if (filters.createdAfter || filters.createdBefore) {
      query.createdAt = {
        ...(filters.createdAfter ? { $gte: new Date(filters.createdAfter) } : {}),
        ...(filters.createdBefore ? { $lte: new Date(filters.createdBefore) } : {}),
      };
    }

    const [docs, total] = await Promise.all([
      MessageModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      MessageModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toMessage), total, { page, limit });
  },

  async update(id, patch): Promise<Message> {
    await getConnection();
    const doc = await MessageModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!doc) throw new Error(`Message ${id} not found`);
    return toMessage(doc);
  },

  async countByStatus(campaignId?: string): Promise<MessageStatusCounts> {
    await getConnection();
    const rows = await MessageModel.aggregate<{ _id: string; count: number }>([
      ...(campaignId ? [{ $match: { campaignId: new mongoose.Types.ObjectId(campaignId) } }] : []),
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).exec();

    const counts = Object.fromEntries(ALL_STATUSES.map((status) => [status, 0])) as unknown as MessageStatusCounts;
    for (const row of rows) {
      if (ALL_STATUSES.includes(row._id as keyof MessageStatusCounts)) {
        counts[row._id as keyof MessageStatusCounts] = row.count;
      }
    }
    return counts;
  },

  async findFailedByCampaign(campaignId: string): Promise<Message[]> {
    await getConnection();
    const docs = await MessageModel.find({ campaignId, status: "failed" }).exec();
    return docs.map(toMessage);
  },
};
