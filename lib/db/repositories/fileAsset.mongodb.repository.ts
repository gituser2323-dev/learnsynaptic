import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { FileAssetModel, toFileAsset } from "@/lib/db/models/fileAsset.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateFileAssetInput,
  FileAsset,
  FileAssetListFilters,
  FileAssetRepository,
} from "@/lib/services/storage/types";

function buildQuery(filters: FileAssetListFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.relatedEntityType) query.relatedEntityType = filters.relatedEntityType;
  if (filters.relatedEntityId) query.relatedEntityId = filters.relatedEntityId;
  if (filters.category) query.category = filters.category;
  if (!filters.includeDeleted) query.deletedAt = { $exists: false };
  return query;
}

export const mongodbFileAssetRepository: FileAssetRepository = {
  async findById(id: string): Promise<FileAsset | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await FileAssetModel.findById(id).exec();
    return doc ? toFileAsset(doc) : null;
  },

  async create(input: CreateFileAssetInput): Promise<FileAsset> {
    await getConnection();
    const doc = await FileAssetModel.create(input);
    return toFileAsset(doc);
  },

  async list(filters: FileAssetListFilters, page: number, limit: number): Promise<PaginatedResult<FileAsset>> {
    await getConnection();
    const query = buildQuery(filters);
    const [docs, total] = await Promise.all([
      FileAssetModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      FileAssetModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toFileAsset), total, { page, limit });
  },

  async softDelete(id: string): Promise<FileAsset> {
    await getConnection();
    const doc = await FileAssetModel.findByIdAndUpdate(id, { $set: { deletedAt: new Date() } }, { new: true }).exec();
    if (!doc) throw new Error(`FileAsset ${id} not found`);
    return toFileAsset(doc);
  },
};
