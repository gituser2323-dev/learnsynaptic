import { getConnection } from "@/lib/db/connection";
import { IntegrationConnectionModel, toIntegrationConnection } from "@/lib/db/models/integrationConnection.model";
import type {
  CreateIntegrationConnectionInput,
  IntegrationConnection,
  IntegrationConnectionRepository,
  UpdateIntegrationConnectionInput,
} from "@/lib/services/integrations/types";

export const mongodbIntegrationConnectionRepository: IntegrationConnectionRepository = {
  async findByProviderId(providerId: string): Promise<IntegrationConnection | null> {
    await getConnection();
    const doc = await IntegrationConnectionModel.findOne({ providerId }).exec();
    return doc ? toIntegrationConnection(doc) : null;
  },

  async list(): Promise<IntegrationConnection[]> {
    await getConnection();
    const docs = await IntegrationConnectionModel.find({}).exec();
    return docs.map(toIntegrationConnection);
  },

  async create(input: CreateIntegrationConnectionInput): Promise<IntegrationConnection> {
    await getConnection();
    const doc = await IntegrationConnectionModel.create({
      providerId: input.providerId,
      status: "connected",
      enabled: true,
      config: input.config ?? {},
      credentialRef: input.credentialRef ?? { type: "none" },
      health: "unknown",
      organizationId: input.organizationId,
    });
    return toIntegrationConnection(doc);
  },

  async update(providerId: string, input: UpdateIntegrationConnectionInput): Promise<IntegrationConnection> {
    await getConnection();
    const update: Record<string, unknown> = { ...input };
    if (input.lastSuccessAt) update.lastSuccessAt = new Date(input.lastSuccessAt);
    if (input.lastFailureAt) update.lastFailureAt = new Date(input.lastFailureAt);
    const doc = await IntegrationConnectionModel.findOneAndUpdate({ providerId }, { $set: update }, { new: true }).exec();
    if (!doc) throw new Error(`IntegrationConnection for provider "${providerId}" not found`);
    return toIntegrationConnection(doc);
  },
};
