import mongoose, { type ClientSession } from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { WhatsAppCampaignModel, toWhatsAppCampaign } from "@/lib/db/models/whatsappCampaign.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateWhatsAppCampaignInput,
  WhatsAppCampaign,
  WhatsAppCampaignListFilters,
  WhatsAppCampaignRepository,
} from "@/lib/services/whatsappCampaigns/types";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const mongodbWhatsAppCampaignRepository: WhatsAppCampaignRepository = {
  async create(input: CreateWhatsAppCampaignInput): Promise<WhatsAppCampaign> {
    await getConnection();
    const doc = await WhatsAppCampaignModel.create(input);
    return toWhatsAppCampaign(doc);
  },

  async findById(id: string): Promise<WhatsAppCampaign | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await WhatsAppCampaignModel.findById(id).exec();
    return doc ? toWhatsAppCampaign(doc) : null;
  },

  async list(
    filters: WhatsAppCampaignListFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<WhatsAppCampaign>> {
    await getConnection();
    const query: Record<string, unknown> = { archived: filters.archived ?? false };
    if (filters.status) query.status = filters.status;
    if (filters.search) query.name = new RegExp(escapeRegex(filters.search), "i");

    const [docs, total] = await Promise.all([
      WhatsAppCampaignModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      WhatsAppCampaignModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toWhatsAppCampaign), total, { page, limit });
  },

  async update(id, patch): Promise<WhatsAppCampaign> {
    await getConnection();
    const doc = await WhatsAppCampaignModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!doc) throw new Error(`WhatsAppCampaign ${id} not found`);
    return toWhatsAppCampaign(doc);
  },

  async incrementCounts(id, delta, session?: ClientSession): Promise<WhatsAppCampaign> {
    await getConnection();
    const inc: Record<string, number> = {};
    for (const [key, value] of Object.entries(delta)) {
      if (value) inc[key] = value;
    }
    const doc = await WhatsAppCampaignModel.findByIdAndUpdate(id, { $inc: inc }, { new: true, session }).exec();
    if (!doc) throw new Error(`WhatsAppCampaign ${id} not found`);
    return toWhatsAppCampaign(doc);
  },

  async findDueScheduled(now: Date): Promise<WhatsAppCampaign[]> {
    await getConnection();
    const docs = await WhatsAppCampaignModel.find({ status: "scheduled", scheduledFor: { $lte: now } }).exec();
    return docs.map(toWhatsAppCampaign);
  },
};
