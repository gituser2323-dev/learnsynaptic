import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { WebhookDeliveryAttemptModel, toWebhookDeliveryAttempt } from "@/lib/db/models/webhookDeliveryAttempt.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateWebhookDeliveryAttemptInput,
  UpdateWebhookDeliveryAttemptInput,
  WebhookDeliveryAttempt,
  WebhookDeliveryAttemptRepository,
  WebhookDeliveryListFilters,
} from "@/lib/services/webhooks/types";

export const mongodbWebhookDeliveryAttemptRepository: WebhookDeliveryAttemptRepository = {
  async findById(id: string): Promise<WebhookDeliveryAttempt | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await WebhookDeliveryAttemptModel.findById(id).exec();
    return doc ? toWebhookDeliveryAttempt(doc) : null;
  },

  async create(input: CreateWebhookDeliveryAttemptInput): Promise<WebhookDeliveryAttempt> {
    await getConnection();
    const doc = await WebhookDeliveryAttemptModel.create(input);
    return toWebhookDeliveryAttempt(doc);
  },

  async update(id: string, input: UpdateWebhookDeliveryAttemptInput): Promise<WebhookDeliveryAttempt> {
    await getConnection();
    const doc = await WebhookDeliveryAttemptModel.findByIdAndUpdate(id, { $set: input }, { new: true }).exec();
    if (!doc) throw new Error(`WebhookDeliveryAttempt ${id} not found`);
    return toWebhookDeliveryAttempt(doc);
  },

  async list(filters: WebhookDeliveryListFilters, page: number, limit: number): Promise<PaginatedResult<WebhookDeliveryAttempt>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.endpointId) query.endpointId = filters.endpointId;
    if (filters.outcome) query.outcome = filters.outcome;
    if (filters.eventType) query.eventType = filters.eventType;
    const [docs, total] = await Promise.all([
      WebhookDeliveryAttemptModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      WebhookDeliveryAttemptModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toWebhookDeliveryAttempt), total, { page, limit });
  },
};
