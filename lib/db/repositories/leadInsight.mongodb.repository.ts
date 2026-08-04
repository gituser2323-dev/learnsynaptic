import { getConnection } from "@/lib/db/connection";
import { LeadInsightModel, toLeadInsight } from "@/lib/db/models/leadInsight.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateLeadInsightInput,
  LeadInsight,
  LeadInsightListFilters,
  LeadInsightRepository,
} from "@/lib/services/crm/leadInsights/types";

export const mongodbLeadInsightRepository: LeadInsightRepository = {
  async create(input: CreateLeadInsightInput): Promise<LeadInsight> {
    await getConnection();
    const doc = await LeadInsightModel.create(input);
    return toLeadInsight(doc);
  },

  async list(filters: LeadInsightListFilters, page: number, limit: number): Promise<PaginatedResult<LeadInsight>> {
    await getConnection();
    const query = { leadId: filters.leadId };

    const [docs, total] = await Promise.all([
      LeadInsightModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      LeadInsightModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toLeadInsight), total, { page, limit });
  },

  async findLatest(leadId: string): Promise<LeadInsight | null> {
    await getConnection();
    const doc = await LeadInsightModel.findOne({ leadId }).sort({ createdAt: -1 }).exec();
    return doc ? toLeadInsight(doc) : null;
  },
};
