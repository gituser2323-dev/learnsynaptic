import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { OrganizationModel, toOrganization } from "@/lib/db/models/organization.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type { CreateOrganizationInput, Organization, OrganizationRepository } from "@/lib/services/organizations/types";

export const mongodbOrganizationRepository: OrganizationRepository = {
  async findById(id: string): Promise<Organization | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await OrganizationModel.findById(id).exec();
    return doc ? toOrganization(doc) : null;
  },

  async findBySlug(slug: string): Promise<Organization | null> {
    await getConnection();
    const doc = await OrganizationModel.findOne({ slug: slug.toLowerCase() }).exec();
    return doc ? toOrganization(doc) : null;
  },

  async create(input: CreateOrganizationInput): Promise<Organization> {
    await getConnection();
    try {
      const doc = await OrganizationModel.create({ ...input, slug: input.slug.toLowerCase() });
      return toOrganization(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("Organization", { slug: input.slug });
      }
      throw error;
    }
  },
};
