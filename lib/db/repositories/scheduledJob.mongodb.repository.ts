import { getConnection } from "@/lib/db/connection";
import { ScheduledJobModel, toScheduledJob } from "@/lib/db/models/scheduledJob.model";
import { buildPaginatedResult } from "@/lib/pagination";
import type { PaginatedResult } from "@/lib/pagination";
import type {
  CreateScheduledJobInput,
  QueueMetrics,
  ScheduledJob,
  ScheduledJobListFilters,
  ScheduledJobRepository,
  ScheduledJobStatus,
} from "@/lib/services/scheduler/types";

const ALL_STATUSES: ScheduledJobStatus[] = ["pending", "processing", "completed", "failed", "dead_lettered", "cancelled"];

export const mongodbScheduledJobRepository: ScheduledJobRepository = {
  async create(input: CreateScheduledJobInput): Promise<ScheduledJob> {
    await getConnection();
    const doc = await ScheduledJobModel.create({
      ...input,
      status: "pending",
      attempts: 0,
      runAt: new Date(input.runAt),
    });
    return toScheduledJob(doc);
  },

  async findDue(now: Date, limit: number): Promise<ScheduledJob[]> {
    await getConnection();
    const docs = await ScheduledJobModel.find({ status: "pending", runAt: { $lte: now } })
      .sort({ runAt: 1 })
      .limit(limit)
      .exec();
    return docs.map(toScheduledJob);
  },

  async claim(id: string): Promise<ScheduledJob | null> {
    await getConnection();
    // The one atomic operation this fix depends on: MongoDB guarantees
    // findOneAndUpdate's read-modify-write is atomic per document, so
    // two concurrent callers racing on the SAME id can never both see
    // status:"pending" and both succeed — exactly one wins.
    const doc = await ScheduledJobModel.findOneAndUpdate({ _id: id, status: "pending" }, { $set: { status: "processing" } }, { new: true }).exec();
    return doc ? toScheduledJob(doc) : null;
  },

  async findById(id: string): Promise<ScheduledJob | null> {
    await getConnection();
    const doc = await ScheduledJobModel.findById(id).exec();
    return doc ? toScheduledJob(doc) : null;
  },

  async list(filters: ScheduledJobListFilters, page: number, limit: number): Promise<PaginatedResult<ScheduledJob>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.jobType) query.jobType = filters.jobType;
    if (filters.organizationId) query.organizationId = filters.organizationId;

    const [docs, total] = await Promise.all([
      ScheduledJobModel.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      ScheduledJobModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toScheduledJob), total, { page, limit });
  },

  async getQueueMetrics(organizationId?: string): Promise<QueueMetrics> {
    await getConnection();
    const baseQuery: Record<string, unknown> = {};
    if (organizationId) baseQuery.organizationId = organizationId;

    const now = new Date();
    const [counts, oldestPending, retriedFailureCount, failuresByJobType] = await Promise.all([
      Promise.all(ALL_STATUSES.map((status) => ScheduledJobModel.countDocuments({ ...baseQuery, status }).exec())),
      // Found live (RC-3 browser verification): several real job types
      // (automation.tick, whatsapp.template_sync, ...) self-reschedule
      // by staying "pending" with a runAt minutes/hours in the FUTURE —
      // a normal, healthy state, not a poller falling behind. Without
      // `runAt: { $lte: now }` here, the "oldest pending job" pick could
      // land on one of those and report a NEGATIVE age. Only a job
      // that's actually due counts toward staleness.
      ScheduledJobModel.findOne({ ...baseQuery, status: "pending", runAt: { $lte: now } }).sort({ runAt: 1 }).exec(),
      ScheduledJobModel.countDocuments({ ...baseQuery, status: { $in: ["failed", "dead_lettered"] }, attempts: { $gt: 1 } }).exec(),
      ScheduledJobModel.aggregate([
        { $match: { ...baseQuery, status: { $in: ["failed", "dead_lettered"] } } },
        { $group: { _id: "$jobType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]).exec() as Promise<{ _id: string; count: number }[]>,
    ]);

    const countsByStatus = Object.fromEntries(ALL_STATUSES.map((status, i) => [status, counts[i]])) as Record<ScheduledJobStatus, number>;
    const oldestPendingJobAgeSeconds = oldestPending ? Math.floor((now.getTime() - new Date(oldestPending.runAt).getTime()) / 1000) : null;

    return {
      countsByStatus,
      oldestPendingJobAgeSeconds,
      retriedFailureCount,
      failuresByJobType: failuresByJobType.map((row) => ({ jobType: row._id, count: row.count })),
    };
  },

  async update(id, patch): Promise<ScheduledJob> {
    await getConnection();
    const update: Record<string, unknown> = { ...patch };
    if (patch.runAt) update.runAt = new Date(patch.runAt);
    const doc = await ScheduledJobModel.findByIdAndUpdate(id, update, { new: true }).exec();
    if (!doc) throw new Error(`ScheduledJob ${id} not found`);
    return toScheduledJob(doc);
  },
};
