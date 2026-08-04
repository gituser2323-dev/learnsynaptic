import { getConnection } from "@/lib/db/connection";
import { ConversationInsightModel, toConversationInsight } from "@/lib/db/models/conversationInsight.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  ConversationInsight,
  ConversationInsightListFilters,
  ConversationInsightRepository,
  CreateConversationInsightInput,
} from "@/lib/services/conversations/insights/types";

export const mongodbConversationInsightRepository: ConversationInsightRepository = {
  async create(input: CreateConversationInsightInput): Promise<ConversationInsight> {
    await getConnection();
    const doc = await ConversationInsightModel.create(input);
    return toConversationInsight(doc);
  },

  async list(filters: ConversationInsightListFilters, page: number, limit: number): Promise<PaginatedResult<ConversationInsight>> {
    await getConnection();
    const query = { conversationId: filters.conversationId };

    const [docs, total] = await Promise.all([
      ConversationInsightModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      ConversationInsightModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toConversationInsight), total, { page, limit });
  },

  async findLatest(conversationId: string): Promise<ConversationInsight | null> {
    await getConnection();
    const doc = await ConversationInsightModel.findOne({ conversationId }).sort({ createdAt: -1 }).exec();
    return doc ? toConversationInsight(doc) : null;
  },

  async listForLead(leadId: string, limit: number): Promise<ConversationInsight[]> {
    await getConnection();
    const docs = await ConversationInsightModel.find({ leadId }).sort({ createdAt: -1 }).limit(limit).exec();
    return docs.map(toConversationInsight);
  },
};
