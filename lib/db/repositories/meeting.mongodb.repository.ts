import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { MeetingModel, toMeeting } from "@/lib/db/models/meeting.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateMeetingRecordInput,
  Meeting,
  MeetingListFilters,
  MeetingRepository,
  UpdateMeetingRecordInput,
} from "@/lib/services/calendar/types";

function buildQuery(filters: MeetingListFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.relatedEntityType) query.relatedEntityType = filters.relatedEntityType;
  if (filters.relatedEntityId) query.relatedEntityId = filters.relatedEntityId;
  if (filters.provider) query.provider = filters.provider;
  if (filters.status) query.status = filters.status;
  if (!filters.includeDeleted) query.deletedAt = { $exists: false };
  return query;
}

export const mongodbMeetingRepository: MeetingRepository = {
  async findById(id: string): Promise<Meeting | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await MeetingModel.findById(id).exec();
    return doc ? toMeeting(doc) : null;
  },

  async create(input: CreateMeetingRecordInput): Promise<Meeting> {
    await getConnection();
    const doc = await MeetingModel.create(input);
    return toMeeting(doc);
  },

  async update(id: string, input: UpdateMeetingRecordInput): Promise<Meeting> {
    await getConnection();
    const doc = await MeetingModel.findByIdAndUpdate(id, { $set: input }, { new: true }).exec();
    if (!doc) throw new Error(`Meeting ${id} not found`);
    return toMeeting(doc);
  },

  async list(filters: MeetingListFilters, page: number, limit: number): Promise<PaginatedResult<Meeting>> {
    await getConnection();
    const query = buildQuery(filters);
    const [docs, total] = await Promise.all([
      MeetingModel.find(query)
        .sort({ startAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      MeetingModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toMeeting), total, { page, limit });
  },

  async findPendingReminders(before: Date): Promise<Meeting[]> {
    await getConnection();
    const docs = await MeetingModel.find({
      status: { $in: ["scheduled", "confirmed"] },
      deletedAt: { $exists: false },
      reminderMinutesBefore: { $exists: true, $ne: null },
      reminderSentAt: { $exists: false },
      $expr: { $lte: [{ $subtract: ["$startAt", { $multiply: ["$reminderMinutesBefore", 60000] } ] }, before] },
    }).exec();
    return docs.map(toMeeting);
  },
};
