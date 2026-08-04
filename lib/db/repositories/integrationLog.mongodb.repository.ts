import { getConnection } from "@/lib/db/connection";
import { IntegrationLogModel, toIntegrationLog } from "@/lib/db/models/integrationLog.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateIntegrationLogInput,
  IntegrationLog,
  IntegrationLogListFilters,
  IntegrationLogRepository,
} from "@/lib/services/integrations/types";

export const mongodbIntegrationLogRepository: IntegrationLogRepository = {
  async create(input: CreateIntegrationLogInput): Promise<IntegrationLog> {
    await getConnection();
    const doc = await IntegrationLogModel.create(input);
    return toIntegrationLog(doc);
  },

  async list(filters: IntegrationLogListFilters, page: number, limit: number): Promise<PaginatedResult<IntegrationLog>> {
    await getConnection();
    const query = { providerId: filters.providerId };

    const [docs, total] = await Promise.all([
      IntegrationLogModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      IntegrationLogModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toIntegrationLog), total, { page, limit });
  },
};
