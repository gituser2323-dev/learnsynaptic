import { getConnection } from "@/lib/db/connection";
import { WebhookDeliveryModel, toWebhookDelivery } from "@/lib/db/models/webhookDelivery.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateWebhookDeliveryInput,
  WebhookDelivery,
  WebhookDeliveryListFilters,
  WebhookDeliveryRepository,
} from "@/lib/services/webhookMonitoring/types";

export const mongodbWebhookDeliveryRepository: WebhookDeliveryRepository = {
  async create(input: CreateWebhookDeliveryInput): Promise<WebhookDelivery> {
    await getConnection();
    const doc = await WebhookDeliveryModel.create(input);
    return toWebhookDelivery(doc);
  },

  async list(filters: WebhookDeliveryListFilters, page: number, limit: number): Promise<PaginatedResult<WebhookDelivery>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.source) query.source = filters.source;
    if (filters.outcome) query.outcome = filters.outcome;

    const [docs, total] = await Promise.all([
      WebhookDeliveryModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      WebhookDeliveryModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toWebhookDelivery), total, { page, limit });
  },
};
