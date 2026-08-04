import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { CampaignTemplateModel, toCampaignTemplate } from "@/lib/db/models/campaignTemplate.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CampaignTemplate,
  CampaignTemplateListFilters,
  CampaignTemplateRepository,
  CreateCampaignTemplateInput,
  UpdateCampaignTemplateApprovalInput,
} from "@/lib/services/whatsappCampaigns/types";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const mongodbCampaignTemplateRepository: CampaignTemplateRepository = {
  async create(input: CreateCampaignTemplateInput): Promise<CampaignTemplate> {
    await getConnection();
    const doc = await CampaignTemplateModel.create(input);
    return toCampaignTemplate(doc);
  },

  async findById(id: string): Promise<CampaignTemplate | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await CampaignTemplateModel.findById(id).exec();
    return doc ? toCampaignTemplate(doc) : null;
  },

  async list(
    filters: CampaignTemplateListFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<CampaignTemplate>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.search) {
      const regex = new RegExp(escapeRegex(filters.search), "i");
      query.$or = [{ name: regex }, { metaTemplateName: regex }];
    }

    const [docs, total] = await Promise.all([
      CampaignTemplateModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      CampaignTemplateModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toCampaignTemplate), total, { page, limit });
  },

  async listAll(): Promise<CampaignTemplate[]> {
    await getConnection();
    const docs = await CampaignTemplateModel.find({}).exec();
    return docs.map(toCampaignTemplate);
  },

  async updateApprovalStatus(id: string, patch: UpdateCampaignTemplateApprovalInput): Promise<CampaignTemplate> {
    await getConnection();
    const doc = await CampaignTemplateModel.findByIdAndUpdate(
      id,
      { approvalStatus: patch.approvalStatus, approvalStatusCheckedAt: new Date(patch.approvalStatusCheckedAt) },
      { new: true },
    ).exec();
    if (!doc) throw new Error(`CampaignTemplate ${id} not found`);
    return toCampaignTemplate(doc);
  },
};
