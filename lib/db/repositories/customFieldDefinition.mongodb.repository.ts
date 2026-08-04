import { getConnection } from "@/lib/db/connection";
import { CustomFieldDefinitionModel, toCustomFieldDefinition } from "@/lib/db/models/customFieldDefinition.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type {
  CreateCustomFieldDefinitionInput,
  CustomFieldDefinition,
  CustomFieldDefinitionRepository,
} from "@/lib/services/crm/customFields/types";

export const mongodbCustomFieldDefinitionRepository: CustomFieldDefinitionRepository = {
  async findByKey(key: string): Promise<CustomFieldDefinition | null> {
    await getConnection();
    const doc = await CustomFieldDefinitionModel.findOne({ key: key.toLowerCase() }).exec();
    return doc ? toCustomFieldDefinition(doc) : null;
  },

  async create(input: CreateCustomFieldDefinitionInput): Promise<CustomFieldDefinition> {
    await getConnection();
    try {
      const doc = await CustomFieldDefinitionModel.create({ ...input, key: input.key.toLowerCase() });
      return toCustomFieldDefinition(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("CustomFieldDefinition", { key: input.key });
      }
      throw error;
    }
  },

  async list(): Promise<CustomFieldDefinition[]> {
    await getConnection();
    const docs = await CustomFieldDefinitionModel.find().sort({ createdAt: 1 }).exec();
    return docs.map(toCustomFieldDefinition);
  },

  async delete(id: string): Promise<void> {
    await getConnection();
    await CustomFieldDefinitionModel.deleteOne({ _id: id }).exec();
  },
};
