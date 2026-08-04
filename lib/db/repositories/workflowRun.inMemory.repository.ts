import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
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

const store: WorkflowRun[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryWorkflowRunRepository: WorkflowRunRepository = {
  async create(input: CreateWorkflowRunInput): Promise<WorkflowRun> {
    const run: WorkflowRun = stampTenant<WorkflowRun>({
      ...input,
      id: randomUUID(),
      currentStepIndex: 0,
      status: "pending",
      nextRunAt: nowIso(),
      attempts: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(run);
    return run;
  },

  // Business OS Phase 8, Module 8.1 — deliberately NOT scoped to the
  // active tenant: this is the automation engine's own scheduled-tick
  // sweep (engine.ts's runDueWorkflowSteps), which by its nature must
  // see every organization's due runs in one pass, the same reason
  // scheduledJob/payment's own findStalePending stay unscoped. The
  // engine itself resolves each found run's own organizationId and
  // wraps that run's processing in runWithTenantContext individually —
  // see engine.ts's own doc comment on why "tenant context only via an
  // HTTP request" would be unsafe here (mission's own explicit
  // BACKGROUND PROCESSING requirement).
  async findDue(now: Date): Promise<WorkflowRun[]> {
    const staleBefore = now.getTime() - STALE_CLAIM_MS;
    return store.filter((run) => {
      if ((run.status === "pending" || run.status === "waiting") && new Date(run.nextRunAt) <= now) return true;
      // RC-3 — crash/timeout recovery: see mongodb repository's own
      // identical doc comment on findDue().
      if (run.status === "processing" && new Date(run.updatedAt).getTime() <= staleBefore) return true;
      return false;
    });
  },

  async claim(id: string, staleBefore: Date): Promise<WorkflowRun | null> {
    const run = store.find((r) => r.id === id);
    if (!run) return null;
    const isFreshlyDue = run.status === "pending" || run.status === "waiting";
    const isStaleProcessing = run.status === "processing" && new Date(run.updatedAt).getTime() <= staleBefore.getTime();
    if (!isFreshlyDue && !isStaleProcessing) return null;
    run.status = "processing";
    run.updatedAt = nowIso();
    return run;
  },

  async findById(id: string): Promise<WorkflowRun | null> {
    return store.find((r) => r.id === id) ?? null;
  },

  async findActiveByEntity(entityType: string, entityId: string): Promise<WorkflowRun[]> {
    return scopeToTenant(store).filter(
      (run) =>
        run.entityType === entityType &&
        run.entityId === entityId &&
        (run.status === "pending" || run.status === "waiting" || run.status === "processing"),
    );
  },

  // Not scoped via findOwnedByTenant: called by the engine's own
  // per-run tick after it has already resolved and entered that run's
  // specific tenant context (see findDue's own doc above) — scoping
  // here too would be redundant, not unsafe, but this keeps the one
  // real scoping decision for a WorkflowRun update in the caller that
  // actually knows which org it's processing.
  async update(id: string, patch: WorkflowRunUpdatePatch): Promise<WorkflowRun> {
    const run = store.find((r) => r.id === id);
    if (!run) throw new Error(`WorkflowRun ${id} not found`);
    Object.assign(run, patch, { updatedAt: nowIso() });
    return run;
  },

  async list(filters: WorkflowRunListFilters, page: number, limit: number): Promise<PaginatedResult<WorkflowRun>> {
    let results = scopeToTenant(store);
    if (filters.status) results = results.filter((r) => r.status === filters.status);
    if (filters.workflowId) results = results.filter((r) => r.workflowId === filters.workflowId);
    if (filters.entityType) results = results.filter((r) => r.entityType === filters.entityType);
    if (filters.entityId) results = results.filter((r) => r.entityId === filters.entityId);
    if (filters.createdAfter) results = results.filter((r) => r.createdAt >= filters.createdAfter!);
    if (filters.createdBefore) results = results.filter((r) => r.createdAt <= filters.createdBefore!);
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },
};
