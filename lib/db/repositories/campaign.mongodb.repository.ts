import mongoose, { type ClientSession } from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { CampaignModel, toCampaign } from "@/lib/db/models/campaign.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type { Campaign, CampaignListFilters, CampaignRepository, CreateCampaignInput } from "./types";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const mongodbCampaignRepository: CampaignRepository = {
  async findByCode(code: string): Promise<Campaign | null> {
    await getConnection();
    const doc = await CampaignModel.findOne({ code: code.toUpperCase() }).exec();
    return doc ? toCampaign(doc) : null;
  },

  async findById(id: string): Promise<Campaign | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await CampaignModel.findById(id).exec();
    return doc ? toCampaign(doc) : null;
  },

  async create(input: CreateCampaignInput, session?: ClientSession): Promise<Campaign> {
    await getConnection();
    try {
      const [doc] = await CampaignModel.create([input], { session });
      return toCampaign(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("Campaign", { code: input.code });
      }
      throw error;
    }
  },

  async listActive(): Promise<Campaign[]> {
    await getConnection();
    const docs = await CampaignModel.find({ status: "active" }).sort({ startDate: -1 }).exec();
    return docs.map(toCampaign);
  },

  async incrementRegistrationCount(id: string, session?: ClientSession): Promise<Campaign> {
    await getConnection();
    const doc = await CampaignModel.findByIdAndUpdate(
      id,
      { $inc: { registrationCount: 1 } },
      { new: true, session },
    ).exec();
    if (!doc) throw new Error(`Campaign ${id} not found`);
    return toCampaign(doc);
  },

  async list(filters: CampaignListFilters, page: number, limit: number): Promise<PaginatedResult<Campaign>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.channel) query.channel = filters.channel;
    if (filters.search) {
      const regex = new RegExp(escapeRegex(filters.search), "i");
      query.$or = [{ name: regex }, { code: regex }];
    }

    const [docs, total] = await Promise.all([
      CampaignModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      CampaignModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toCampaign), total, { page, limit });
  },
};
