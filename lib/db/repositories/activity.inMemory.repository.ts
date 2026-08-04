import { randomUUID } from "crypto";
import { buildPaginatedResult } from "@/lib/pagination";
import { scopeToTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  Activity,
  ActivityListFilters,
  ActivityRepository,
  CreateActivityInput,
} from "@/lib/services/crm/activities/types";

const store: Activity[] = [];

export const inMemoryActivityRepository: ActivityRepository = {
  async create(input: CreateActivityInput): Promise<Activity> {
    const activity: Activity = stampTenant({
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    });
    store.push(activity);
    return activity;
  },

  async listForEntity(filters: ActivityListFilters, page: number, limit: number) {
    const results = scopeToTenant(store)
      .filter((a) => a.entityType === filters.entityType && a.entityId === filters.entityId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },
};
