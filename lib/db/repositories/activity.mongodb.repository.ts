import { getConnection } from "@/lib/db/connection";
import { ActivityModel, toActivity } from "@/lib/db/models/activity.model";
import { buildPaginatedResult } from "@/lib/pagination";
import type {
  ActivityListFilters,
  ActivityRepository,
  CreateActivityInput,
} from "@/lib/services/crm/activities/types";

export const mongodbActivityRepository: ActivityRepository = {
  async create(input: CreateActivityInput) {
    await getConnection();
    const doc = await ActivityModel.create(input);
    return toActivity(doc);
  },

  async listForEntity(filters: ActivityListFilters, page: number, limit: number) {
    await getConnection();
    const query = { entityType: filters.entityType, entityId: filters.entityId };
    const [docs, total] = await Promise.all([
      ActivityModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      ActivityModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toActivity), total, { page, limit });
  },
};
