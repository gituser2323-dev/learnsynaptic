import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { PipelineModel, toPipeline } from "@/lib/db/models/pipeline.model";
import type { CreatePipelineInput, Pipeline, PipelineRepository } from "@/lib/services/crm/pipelines/types";

export const mongodbPipelineRepository: PipelineRepository = {
  async findById(id: string): Promise<Pipeline | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await PipelineModel.findById(id).exec();
    return doc ? toPipeline(doc) : null;
  },

  async getDefault(): Promise<Pipeline | null> {
    await getConnection();
    const doc = await PipelineModel.findOne({ isDefault: true }).exec();
    return doc ? toPipeline(doc) : null;
  },

  async create(input: CreatePipelineInput): Promise<Pipeline> {
    await getConnection();
    const stages = input.stages.map((s, index) => ({ ...s, order: index }));
    const doc = await PipelineModel.create({ ...input, stages });
    return toPipeline(doc);
  },

  async list(): Promise<Pipeline[]> {
    await getConnection();
    const docs = await PipelineModel.find().sort({ createdAt: 1 }).exec();
    return docs.map(toPipeline);
  },

  async delete(id: string): Promise<void> {
    if (!mongoose.isValidObjectId(id)) return;
    await getConnection();
    await PipelineModel.findByIdAndDelete(id).exec();
  },
};
