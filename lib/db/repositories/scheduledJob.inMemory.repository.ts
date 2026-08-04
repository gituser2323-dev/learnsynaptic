import { randomUUID } from "crypto";
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

const store: ScheduledJob[] = [];
const ALL_STATUSES: ScheduledJobStatus[] = ["pending", "processing", "completed", "failed", "dead_lettered", "cancelled"];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryScheduledJobRepository: ScheduledJobRepository = {
  async create(input: CreateScheduledJobInput): Promise<ScheduledJob> {
    const job: ScheduledJob = {
      ...input,
      status: "pending",
      attempts: 0,
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.push(job);
    return job;
  },

  async findDue(now: Date, limit: number): Promise<ScheduledJob[]> {
    return store
      .filter((job) => job.status === "pending" && new Date(job.runAt).getTime() <= now.getTime())
      .sort((a, b) => a.runAt.localeCompare(b.runAt))
      .slice(0, limit);
  },

  async claim(id: string): Promise<ScheduledJob | null> {
    // Node's single-threaded event loop means there's no real race
    // WITHIN this process — but the API contract (null if not
    // currently "pending") must match the mongodb implementation
    // exactly, since callers (schedulerService.processJob) depend on
    // that contract regardless of which repository backs it.
    const job = store.find((j) => j.id === id);
    if (!job || job.status !== "pending") return null;
    job.status = "processing";
    job.updatedAt = nowIso();
    return job;
  },

  async findById(id: string): Promise<ScheduledJob | null> {
    return store.find((j) => j.id === id) ?? null;
  },

  async list(filters: ScheduledJobListFilters, page: number, limit: number): Promise<PaginatedResult<ScheduledJob>> {
    const filtered = store
      .filter((j) => (filters.status ? j.status === filters.status : true))
      .filter((j) => (filters.jobType ? j.jobType === filters.jobType : true))
      .filter((j) => (filters.organizationId ? j.organizationId === filters.organizationId : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const start = (page - 1) * limit;
    return buildPaginatedResult(filtered.slice(start, start + limit), filtered.length, { page, limit });
  },

  async getQueueMetrics(organizationId?: string): Promise<QueueMetrics> {
    const scoped = organizationId ? store.filter((j) => j.organizationId === organizationId) : store;

    const countsByStatus = Object.fromEntries(
      ALL_STATUSES.map((status) => [status, scoped.filter((j) => j.status === status).length]),
    ) as Record<ScheduledJobStatus, number>;

    const now = Date.now();
    // Only a job that's actually due counts toward staleness — a
    // self-rescheduling recurring job legitimately sits "pending" with
    // a future runAt between ticks (see QueueMetrics' own doc comment).
    const overduePendingJobs = scoped
      .filter((j) => j.status === "pending" && new Date(j.runAt).getTime() <= now)
      .sort((a, b) => a.runAt.localeCompare(b.runAt));
    const oldestPendingJobAgeSeconds = overduePendingJobs[0] ? Math.floor((now - new Date(overduePendingJobs[0].runAt).getTime()) / 1000) : null;

    const failedOrDeadLettered = scoped.filter((j) => j.status === "failed" || j.status === "dead_lettered");
    const retriedFailureCount = failedOrDeadLettered.filter((j) => j.attempts > 1).length;

    const failureCountsByJobType = new Map<string, number>();
    for (const job of failedOrDeadLettered) {
      failureCountsByJobType.set(job.jobType, (failureCountsByJobType.get(job.jobType) ?? 0) + 1);
    }
    const failuresByJobType = Array.from(failureCountsByJobType.entries())
      .map(([jobType, count]) => ({ jobType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return { countsByStatus, oldestPendingJobAgeSeconds, retriedFailureCount, failuresByJobType };
  },

  async update(id, patch): Promise<ScheduledJob> {
    const job = store.find((j) => j.id === id);
    if (!job) throw new Error(`ScheduledJob ${id} not found`);
    Object.assign(job, patch, { updatedAt: nowIso() });
    return job;
  },
};
