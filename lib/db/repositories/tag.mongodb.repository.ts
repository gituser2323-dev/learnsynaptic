import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { TagModel, toTag } from "@/lib/db/models/tag.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type { CreateTagInput, Tag, TagRepository } from "@/lib/services/crm/tags/types";

export const mongodbTagRepository: TagRepository = {
  async findById(id: string): Promise<Tag | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await TagModel.findById(id).exec();
    return doc ? toTag(doc) : null;
  },

  async findByIds(ids: string[]): Promise<Tag[]> {
    const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length === 0) return [];
    await getConnection();
    const docs = await TagModel.find({ _id: { $in: validIds } }).exec();
    return docs.map(toTag);
  },

  async create(input: CreateTagInput): Promise<Tag> {
    await getConnection();
    try {
      const doc = await TagModel.create(input);
      return toTag(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("Tag", { label: input.label });
      }
      throw error;
    }
  },

  async list(): Promise<Tag[]> {
    await getConnection();
    const docs = await TagModel.find().sort({ label: 1 }).exec();
    return docs.map(toTag);
  },

  async delete(id: string): Promise<void> {
    await getConnection();
    await TagModel.deleteOne({ _id: id }).exec();
  },
};
