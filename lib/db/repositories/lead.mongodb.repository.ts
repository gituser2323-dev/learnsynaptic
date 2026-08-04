import mongoose, { type ClientSession } from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { LeadModel, toLead } from "@/lib/db/models/lead.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateLeadInput,
  DuplicateLeadGroup,
  Lead,
  LeadListFilters,
  LeadRepository,
  UpdateLeadInput,
  UtmBreakdownRow,
} from "@/lib/services/leads/types";

/** Guards against a user's search string being interpreted as regex
 *  syntax (e.g. a stray `(` or `*`) — treat it as a literal substring. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildQuery(filters: LeadListFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.source) query.source = filters.source;
  if (filters.program) query.program = filters.program;
  if (filters.createdAfter || filters.createdBefore) {
    const range: Record<string, Date> = {};
    if (filters.createdAfter) range.$gte = new Date(filters.createdAfter);
    if (filters.createdBefore) range.$lte = new Date(filters.createdBefore);
    query.createdAt = range;
  }
  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), "i");
    query.$or = [{ name: regex }, { email: regex }, { phone: regex }, { program: regex }];
  }
  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $in: filters.tags.filter((id) => mongoose.isValidObjectId(id)) };
  }
  if (filters.assignedCounsellorId) {
    query.assignedCounsellorId = filters.assignedCounsellorId;
  }
  if (filters.utmCampaign) query["utm.utmCampaign"] = filters.utmCampaign;
  if (filters.health) query.health = filters.health;
  // Undefined means "don't filter by archived" — callers that want
  // "active only" must say so explicitly (leadService defaults it).
  // Leads created before Phase 1 predate the `archived` field entirely
  // (no schema backfill was run), so `archived: false` must also match
  // "field absent," not just a literal false — otherwise every
  // pre-Phase-1 lead silently vanishes from the default list view.
  if (filters.archived === false) query.archived = { $ne: true };
  else if (filters.archived === true) query.archived = true;
  return query;
}

/**
 * Real MongoDB-backed Lead repository, built on the shared connection in
 * lib/db/connection.ts. Selected automatically by lib/db/registry.ts
 * whenever MongoDB is configured — implements the LeadRepository
 * interface owned by lib/services/leads/types.ts (that module still owns
 * the port; only the concrete implementation lives here now).
 */
export const mongodbLeadRepository: LeadRepository = {
  async findByPhoneOrEmail(phone: string, email: string, session?: ClientSession): Promise<Lead | null> {
    await getConnection();
    const doc = await LeadModel.findOne({ $or: [{ phone }, { email }] })
      .session(session ?? null)
      .exec();
    return doc ? toLead(doc) : null;
  },

  async findById(id: string, session?: ClientSession): Promise<Lead | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await LeadModel.findById(id).session(session ?? null).exec();
    return doc ? toLead(doc) : null;
  },

  async create(input: CreateLeadInput, session?: ClientSession): Promise<Lead> {
    await getConnection();
    const [doc] = await LeadModel.create([input], { session });
    return toLead(doc);
  },

  async recordTouchpoint(id: string, session?: ClientSession): Promise<Lead> {
    await getConnection();
    const doc = await LeadModel.findByIdAndUpdate(
      id,
      { updatedAt: new Date() },
      { new: true, session },
    ).exec();
    if (!doc) throw new Error(`Lead ${id} not found`);
    return toLead(doc);
  },

  async list(filters: LeadListFilters, page: number, limit: number): Promise<PaginatedResult<Lead>> {
    await getConnection();
    const query = buildQuery(filters);

    const [docs, total] = await Promise.all([
      LeadModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      LeadModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toLead), total, { page, limit });
  },

  async utmBreakdown(): Promise<UtmBreakdownRow[]> {
    await getConnection();
    const rows = await LeadModel.aggregate([
      {
        $group: {
          _id: { utmSource: "$utm.utmSource", utmMedium: "$utm.utmMedium", utmCampaign: "$utm.utmCampaign" },
          leadCount: { $sum: 1 },
        },
      },
      { $sort: { leadCount: -1 } },
    ]).exec();

    return rows.map((row) => ({
      utmSource: row._id.utmSource,
      utmMedium: row._id.utmMedium,
      utmCampaign: row._id.utmCampaign,
      leadCount: row.leadCount,
    }));
  },

  async update(id: string, input: UpdateLeadInput): Promise<Lead> {
    await getConnection();
    const doc = await LeadModel.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    if (!doc) throw new Error(`Lead ${id} not found`);
    return toLead(doc);
  },

  async bulkUpdate(ids: string[], input: UpdateLeadInput): Promise<string[]> {
    await getConnection();
    const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length === 0) return [];
    // $addToSet for tags would be additive — bulk "add tag" callers pass
    // the full desired tag array per lead when they need merge semantics
    // (see leadService.bulkTag, which reads-then-writes per lead for
    // exactly that reason); this method itself does a flat $set, the
    // same "generic update path" contract as update() above.
    await LeadModel.updateMany({ _id: { $in: validIds } }, { $set: input }).exec();
    return validIds;
  },

  async bulkDelete(ids: string[]): Promise<string[]> {
    await getConnection();
    const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
    if (validIds.length === 0) return [];
    await LeadModel.deleteMany({ _id: { $in: validIds } }).exec();
    return validIds;
  },

  async listAllIds(filters: LeadListFilters): Promise<string[]> {
    await getConnection();
    const query = buildQuery(filters);
    const docs = await LeadModel.find(query, "_id").exec();
    return docs.map((d) => d._id.toString());
  },

  async findDuplicateGroups(): Promise<DuplicateLeadGroup[]> {
    await getConnection();
    const groups: DuplicateLeadGroup[] = [];

    for (const field of ["phone", "email"] as const) {
      const dupeValues = await LeadModel.aggregate([
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ]).exec();

      for (const { _id: value } of dupeValues) {
        const docs = await LeadModel.find({ [field]: value }).sort({ createdAt: 1 }).exec();
        groups.push({ matchedOn: field, matchedValue: value, leads: docs.map(toLead) });
      }
    }

    return groups;
  },

  async merge(targetId: string, sourceId: string, fieldsFromSource: string[] = []): Promise<Lead> {
    await getConnection();
    const [target, source] = await Promise.all([LeadModel.findById(targetId).exec(), LeadModel.findById(sourceId).exec()]);
    if (!target) throw new Error(`Lead ${targetId} not found`);
    if (!source) throw new Error(`Lead ${sourceId} not found`);

    const overrides: Record<string, unknown> = {};
    for (const field of fieldsFromSource) {
      if (field in source.toObject()) overrides[field] = (source as unknown as Record<string, unknown>)[field];
    }
    // Tags always union — a merge should never silently lose either
    // record's tags, regardless of which fields were explicitly chosen
    // from source.
    overrides.tags = Array.from(new Set([...target.tags.map((t) => t.toString()), ...source.tags.map((t) => t.toString())]));
    overrides.customFields = { ...source.customFields, ...target.customFields };

    const merged = await LeadModel.findByIdAndUpdate(targetId, { $set: overrides }, { new: true }).exec();
    await LeadModel.deleteOne({ _id: sourceId }).exec();
    if (!merged) throw new Error(`Lead ${targetId} not found after merge`);
    return toLead(merged);
  },
};
