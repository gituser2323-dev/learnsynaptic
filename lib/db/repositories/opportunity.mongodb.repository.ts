import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { OpportunityModel, toOpportunity } from "@/lib/db/models/opportunity.model";
import type {
  CreateOpportunityInput,
  Opportunity,
  OpportunityListFilters,
  OpportunityRepository,
  OpportunityStageHistoryEntry,
  UpdateOpportunityInput,
} from "@/lib/services/crm/pipelines/types";

export const mongodbOpportunityRepository: OpportunityRepository = {
  async findById(id: string): Promise<Opportunity | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await OpportunityModel.findById(id).exec();
    return doc ? toOpportunity(doc) : null;
  },

  async create(input: CreateOpportunityInput): Promise<Opportunity> {
    await getConnection();
    const doc = await OpportunityModel.create({
      ...input,
      status: "open",
      stageHistory: [{ stageId: input.stageId, enteredAt: new Date() }],
    });
    return toOpportunity(doc);
  },

  // A `stageId` in the update always means a stage transition (the only
  // caller is pipelineService.moveStage() — see its own doc comment), so
  // it always appends a stageHistory entry rather than needing a second,
  // more specific repository method just for that.
  async update(id: string, input: UpdateOpportunityInput): Promise<Opportunity> {
    await getConnection();
    const { stageId, ...rest } = input;
    const doc = await OpportunityModel.findByIdAndUpdate(
      id,
      stageId
        ? { $set: { ...rest, stageId }, $push: { stageHistory: { stageId, enteredAt: new Date() } } }
        : { $set: rest },
      { new: true },
    ).exec();
    if (!doc) throw new Error(`Opportunity ${id} not found`);
    return toOpportunity(doc);
  },

  async list(filters: OpportunityListFilters): Promise<Opportunity[]> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.pipelineId) query.pipelineId = filters.pipelineId;
    if (filters.stageId) query.stageId = filters.stageId;
    if (filters.status) query.status = filters.status;
    if (filters.ownerId) query.ownerId = filters.ownerId;
    if (filters.leadId) query.leadId = filters.leadId;
    const docs = await OpportunityModel.find(query).sort({ updatedAt: -1 }).exec();
    return docs.map(toOpportunity);
  },

  async seedStageHistory(id: string, entry: OpportunityStageHistoryEntry): Promise<void> {
    await getConnection();
    await OpportunityModel.findByIdAndUpdate(id, {
      $set: { stageHistory: [{ stageId: entry.stageId, enteredAt: new Date(entry.enteredAt) }] },
    }).exec();
  },
};
