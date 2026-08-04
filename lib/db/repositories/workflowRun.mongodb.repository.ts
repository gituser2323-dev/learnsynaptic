import { getConnection } from "@/lib/db/connection";
import { WorkflowRunModel, toWorkflowRun } from "@/lib/db/models/workflowRun.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { STALE_CLAIM_MS } from "@/lib/services/automation/types";
import type {
  CreateWorkflowRunInput,
  WorkflowRun,
  WorkflowRunListFilters,
  WorkflowRunRepository,
} from "@/lib/services/automation/types";

type WorkflowRunUpdatePatch = Partial<
  Pick<WorkflowRun, "currentStepIndex" | "status" | "nextRunAt" | "attempts" | "lastError" | "completionReason">
>;

export const mongodbWorkflowRunRepository: WorkflowRunRepository = {
  async create(input: CreateWorkflowRunInput): Promise<WorkflowRun> {
    await getConnection();
    const doc = await WorkflowRunModel.create({ ...input, nextRunAt: new Date() });
    return toWorkflowRun(doc);
  },

  async findDue(now: Date): Promise<WorkflowRun[]> {
    await getConnection();
    const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
    const docs = await WorkflowRunModel.find({
      $or: [
        { status: { $in: ["pending", "waiting"] }, nextRunAt: { $lte: now } },
        // RC-3 — crash/timeout recovery: a run whose own claim went
        // stale (the process that claimed it never got to persist a
        // real terminal-for-this-tick status) is eligible again, same
        // as a genuinely due pending/waiting run.
        { status: "processing", updatedAt: { $lte: staleBefore } },
      ],
    }).exec();
    return docs.map(toWorkflowRun);
  },

  async claim(id: string, staleBefore: Date): Promise<WorkflowRun | null> {
    await getConnection();
    const doc = await WorkflowRunModel.findOneAndUpdate(
      {
        _id: id,
        $or: [{ status: { $in: ["pending", "waiting"] } }, { status: "processing", updatedAt: { $lte: staleBefore } }],
      },
      { $set: { status: "processing" } },
      { new: true },
    ).exec();
    return doc ? toWorkflowRun(doc) : null;
  },

  async findById(id: string): Promise<WorkflowRun | null> {
    await getConnection();
    const doc = await WorkflowRunModel.findById(id).exec();
    return doc ? toWorkflowRun(doc) : null;
  },

  async findActiveByEntity(entityType: string, entityId: string): Promise<WorkflowRun[]> {
    await getConnection();
    const docs = await WorkflowRunModel.find({
      entityType,
      entityId,
      status: { $in: ["pending", "waiting", "processing"] },
    }).exec();
    return docs.map(toWorkflowRun);
  },

  async update(id: string, patch: WorkflowRunUpdatePatch): Promise<WorkflowRun> {
    await getConnection();
    const doc = await WorkflowRunModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!doc) throw new Error(`WorkflowRun ${id} not found`);
    return toWorkflowRun(doc);
  },

  async list(filters: WorkflowRunListFilters, page: number, limit: number): Promise<PaginatedResult<WorkflowRun>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.workflowId) query.workflowId = filters.workflowId;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.createdAfter || filters.createdBefore) {
      query.createdAt = {
        ...(filters.createdAfter ? { $gte: new Date(filters.createdAfter) } : {}),
        ...(filters.createdBefore ? { $lte: new Date(filters.createdBefore) } : {}),
      };
    }

    const [docs, total] = await Promise.all([
      WorkflowRunModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      WorkflowRunModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toWorkflowRun), total, { page, limit });
  },
};
