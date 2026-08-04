import { getConnection } from "@/lib/db/connection";
import { PaymentWebhookEventModel, toPaymentWebhookEvent } from "@/lib/db/models/paymentWebhookEvent.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type {
  CreatePaymentWebhookEventInput,
  PaymentProviderId,
  PaymentWebhookEvent,
  PaymentWebhookEventListFilters,
  PaymentWebhookEventRepository,
  PaymentWebhookOutcome,
} from "@/lib/services/payments/types";

export const mongodbPaymentWebhookEventRepository: PaymentWebhookEventRepository = {
  async create(input: CreatePaymentWebhookEventInput): Promise<PaymentWebhookEvent> {
    await getConnection();
    try {
      const doc = await PaymentWebhookEventModel.create(input);
      return toPaymentWebhookEvent(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("PaymentWebhookEvent", { provider: input.provider, providerEventId: input.providerEventId });
      }
      throw error;
    }
  },

  async findByProviderEventId(provider: PaymentProviderId, providerEventId: string): Promise<PaymentWebhookEvent | null> {
    await getConnection();
    const doc = await PaymentWebhookEventModel.findOne({ provider, providerEventId }).exec();
    return doc ? toPaymentWebhookEvent(doc) : null;
  },

  async updateOutcome(id: string, patch: { outcome: PaymentWebhookOutcome; detail?: string }): Promise<PaymentWebhookEvent> {
    await getConnection();
    const doc = await PaymentWebhookEventModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!doc) throw new Error(`PaymentWebhookEvent ${id} not found`);
    return toPaymentWebhookEvent(doc);
  },

  async list(filters: PaymentWebhookEventListFilters, page: number, limit: number): Promise<PaginatedResult<PaymentWebhookEvent>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.provider) query.provider = filters.provider;
    if (filters.outcome) query.outcome = filters.outcome;
    const [docs, total] = await Promise.all([
      PaymentWebhookEventModel.find(query)
        .sort({ receivedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      PaymentWebhookEventModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toPaymentWebhookEvent), total, { page, limit });
  },
};
