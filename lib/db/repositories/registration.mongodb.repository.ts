import mongoose, { type ClientSession } from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { RegistrationModel, toRegistration } from "@/lib/db/models/registration.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateRegistrationInput,
  Registration,
  RegistrationAnalytics,
  RegistrationListFilters,
  RegistrationRepository,
  RegistrationStatus,
} from "./types";

const ALL_STATUSES: RegistrationStatus[] = ["pending", "confirmed", "cancelled"];

export const mongodbRegistrationRepository: RegistrationRepository = {
  async findById(id: string): Promise<Registration | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await RegistrationModel.findById(id).exec();
    return doc ? toRegistration(doc) : null;
  },

  async findByLeadAndProgram(leadId: string, programSlug: string): Promise<Registration | null> {
    await getConnection();
    const doc = await RegistrationModel.findOne({ leadId, programSlug }).exec();
    return doc ? toRegistration(doc) : null;
  },

  async findByLead(leadId: string): Promise<Registration[]> {
    await getConnection();
    const docs = await RegistrationModel.find({ leadId }).exec();
    return docs.map(toRegistration);
  },

  async create(input: CreateRegistrationInput, session?: ClientSession): Promise<Registration> {
    await getConnection();
    try {
      const [doc] = await RegistrationModel.create([input], { session });
      return toRegistration(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("Registration", {
          leadId: input.leadId,
          programSlug: input.programSlug,
        });
      }
      throw error;
    }
  },

  async updateStatus(
    id: string,
    status: RegistrationStatus,
    session?: ClientSession,
  ): Promise<Registration> {
    await getConnection();
    const doc = await RegistrationModel.findByIdAndUpdate(id, { status }, { new: true, session }).exec();
    if (!doc) throw new Error(`Registration ${id} not found`);
    return toRegistration(doc);
  },

  async list(
    filters: RegistrationListFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Registration>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.programSlug) query.programSlug = filters.programSlug;
    if (filters.campaignId) query.campaignId = filters.campaignId;
    if (filters.createdAfter || filters.createdBefore) {
      query.createdAt = {
        ...(filters.createdAfter ? { $gte: new Date(filters.createdAfter) } : {}),
        ...(filters.createdBefore ? { $lte: new Date(filters.createdBefore) } : {}),
      };
    }

    const [docs, total] = await Promise.all([
      RegistrationModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      RegistrationModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toRegistration), total, { page, limit });
  },

  async analytics(): Promise<RegistrationAnalytics> {
    await getConnection();
    const [statusRows, programRows, totalRegistrations] = await Promise.all([
      RegistrationModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).exec(),
      RegistrationModel.aggregate([
        { $group: { _id: "$programSlug", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).exec(),
      RegistrationModel.countDocuments({}).exec(),
    ]);

    const byStatus = ALL_STATUSES.reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<RegistrationStatus, number>,
    );
    for (const row of statusRows) {
      if (row._id in byStatus) byStatus[row._id as RegistrationStatus] = row.count;
    }

    return {
      totalRegistrations,
      byStatus,
      byProgram: programRows.map((row) => ({ programSlug: row._id, count: row.count })),
    };
  },
};
