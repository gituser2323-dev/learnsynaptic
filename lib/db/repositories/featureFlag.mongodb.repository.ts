import { getConnection } from "@/lib/db/connection";
import { FeatureFlagModel, toFeatureFlag } from "@/lib/db/models/featureFlag.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type { CreateFeatureFlagInput, FeatureFlag, FeatureFlagRepository, UpdateFeatureFlagInput } from "@/lib/services/billing/types";

export const mongodbFeatureFlagRepository: FeatureFlagRepository = {
  async findByKey(key: string): Promise<FeatureFlag | null> {
    await getConnection();
    const doc = await FeatureFlagModel.findOne({ key }).exec();
    return doc ? toFeatureFlag(doc) : null;
  },

  async list(): Promise<FeatureFlag[]> {
    await getConnection();
    const docs = await FeatureFlagModel.find({}).sort({ key: 1 }).exec();
    return docs.map(toFeatureFlag);
  },

  async create(input: CreateFeatureFlagInput): Promise<FeatureFlag> {
    await getConnection();
    try {
      const doc = await FeatureFlagModel.create({
        key: input.key,
        description: input.description,
        enabled: input.enabled ?? false,
        metadata: input.metadata,
      });
      return toFeatureFlag(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new DuplicateKeyError("FeatureFlag", { key: input.key });
      throw error;
    }
  },

  async update(key: string, input: UpdateFeatureFlagInput): Promise<FeatureFlag> {
    await getConnection();
    const doc = await FeatureFlagModel.findOneAndUpdate({ key }, { $set: input }, { new: true }).exec();
    if (!doc) throw new Error(`FeatureFlag "${key}" not found`);
    return toFeatureFlag(doc);
  },
};
