import { getConnection } from "@/lib/db/connection";
import { BrandConfigurationModel, toBrandConfiguration } from "@/lib/db/models/brandConfiguration.model";
import type { BrandConfiguration, BrandConfigurationRepository, UpsertBrandConfigurationInput } from "@/lib/services/branding/types";

export const mongodbBrandConfigurationRepository: BrandConfigurationRepository = {
  async findByOrganizationId(organizationId: string): Promise<BrandConfiguration | null> {
    await getConnection();
    const doc = await BrandConfigurationModel.findOne({ organizationId }).exec();
    return doc ? toBrandConfiguration(doc) : null;
  },

  async upsert(organizationId: string, input: UpsertBrandConfigurationInput): Promise<BrandConfiguration> {
    await getConnection();
    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === null) unset[key] = "";
      else if (value !== undefined) set[key] = value;
    }
    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const doc = await BrandConfigurationModel.findOneAndUpdate({ organizationId }, update, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
    return toBrandConfiguration(doc);
  },

  async deleteByOrganizationId(organizationId: string): Promise<void> {
    await getConnection();
    await BrandConfigurationModel.deleteOne({ organizationId }).exec();
  },
};
