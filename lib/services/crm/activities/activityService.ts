import { getActivityRepository } from "@/lib/db";
import type { PaginatedResult } from "@/lib/pagination";
import type { Activity, ActivityListFilters, CreateActivityInput } from "./types";

/**
 * Application layer for the Lead Timeline. `logSystemEvent` is the one
 * method other Phase 1 services call directly (Task completion,
 * assignment changes, pipeline stage moves) — every one of them wants
 * "record this on the entity's timeline" without owning Activity's
 * persistence themselves, the same dependency shape leadService already
 * has toward auditLogService.
 */
export const activityService = {
  async logActivity(input: CreateActivityInput): Promise<Activity> {
    const repository = await getActivityRepository();
    return repository.create(input);
  },

  async logSystemEvent(
    entityType: CreateActivityInput["entityType"],
    entityId: string,
    body: string,
    organizationId?: string,
  ): Promise<Activity> {
    const repository = await getActivityRepository();
    return repository.create({ entityType, entityId, type: "system", body, organizationId });
  },

  async listTimeline(filters: ActivityListFilters, page = 1, limit = 50): Promise<PaginatedResult<Activity>> {
    const repository = await getActivityRepository();
    return repository.listForEntity(filters, page, limit);
  },
};
