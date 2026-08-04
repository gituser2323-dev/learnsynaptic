import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { WebhookEndpointModel, toWebhookEndpoint } from "@/lib/db/models/webhookEndpoint.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  WebhookEndpoint,
  WebhookEndpointListFilters,
  WebhookEndpointRepository,
} from "@/lib/services/webhooks/types";

export const mongodbWebhookEndpointRepository: WebhookEndpointRepository = {
  async findById(id: string): Promise<WebhookEndpoint | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await WebhookEndpointModel.findById(id).exec();
    return doc ? toWebhookEndpoint(doc) : null;
  },

  async create(input: CreateWebhookEndpointInput): Promise<WebhookEndpoint> {
    await getConnection();
    const doc = await WebhookEndpointModel.create({ ...input, status: "active" });
    return toWebhookEndpoint(doc);
  },

  async update(id: string, input: UpdateWebhookEndpointInput): Promise<WebhookEndpoint> {
    await getConnection();
    const doc = await WebhookEndpointModel.findByIdAndUpdate(id, { $set: input }, { new: true }).exec();
    if (!doc) throw new Error(`WebhookEndpoint ${id} not found`);
    return toWebhookEndpoint(doc);
  },

  async list(filters: WebhookEndpointListFilters, page: number, limit: number): Promise<PaginatedResult<WebhookEndpoint>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    const [docs, total] = await Promise.all([
      WebhookEndpointModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      WebhookEndpointModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toWebhookEndpoint), total, { page, limit });
  },

  async listActive(): Promise<WebhookEndpoint[]> {
    await getConnection();
    const docs = await WebhookEndpointModel.find({ status: "active" }).exec();
    return docs.map(toWebhookEndpoint);
  },
};
