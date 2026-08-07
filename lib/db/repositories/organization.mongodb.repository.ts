import mongoose, { type ClientSession } from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { OrganizationModel, toOrganization } from "@/lib/db/models/organization.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateOrganizationInput,
  Organization,
  OrganizationListFilters,
  OrganizationRepository,
  UpdateOrganizationInput,
} from "@/lib/services/organizations/types";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildQuery(filters: OrganizationListFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  // RC-6 — real bug found via live verification against the local dev
  // database: every organization created before this `status` field
  // existed (the schema's own `default: "active"` only applies to NEW
  // documents, never retroactively) has NO `status` key stored at all
  // — `{status: "active"}` alone silently excluded it. Same "field
  // absent must count as the default" fix this codebase already
  // applies to Lead.archived/Lead.deletedAt (lead.mongodb.repository.ts).
  if (filters.status === "active") query.status = { $in: ["active", null] };
  else if (filters.status === "suspended") query.status = "suspended";
  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), "i");
    query.$or = [{ name: regex }, { slug: regex }];
  }
  return query;
}

/** RC-6 — same "null clears, undefined leaves untouched" convention
 *  `buildUserUpdateOperation` (user.mongodb.repository.ts) already
 *  established for this exact class of problem. */
function buildUpdateOperation(patch: UpdateOrganizationInput): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) unset[key] = 1;
    else if (value !== undefined) set[key] = value;
  }
  const operation: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) operation.$set = set;
  if (Object.keys(unset).length > 0) operation.$unset = unset;
  return operation;
}

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

  async create(input: CreateOrganizationInput, session?: ClientSession): Promise<Organization> {
    await getConnection();
    try {
      const [doc] = await OrganizationModel.create([{ ...input, slug: input.slug.toLowerCase() }], { session });
      return toOrganization(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("Organization", { slug: input.slug });
      }
      throw error;
    }
  },

  async list(filters: OrganizationListFilters, page: number, limit: number): Promise<PaginatedResult<Organization>> {
    await getConnection();
    const query = buildQuery(filters);
    const [docs, total] = await Promise.all([
      OrganizationModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      OrganizationModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toOrganization), total, { page, limit });
  },

  async update(id: string, patch: UpdateOrganizationInput): Promise<Organization> {
    await getConnection();
    const doc = await OrganizationModel.findByIdAndUpdate(id, buildUpdateOperation(patch), { new: true }).exec();
    if (!doc) throw new Error(`Organization ${id} not found`);
    return toOrganization(doc);
  },
};
