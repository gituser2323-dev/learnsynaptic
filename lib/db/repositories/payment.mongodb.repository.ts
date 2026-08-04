import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { PaymentModel, toPayment } from "@/lib/db/models/payment.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreatePaymentRecordInput,
  Payment,
  PaymentListFilters,
  PaymentProviderId,
  PaymentRepository,
  UpdatePaymentRecordInput,
} from "@/lib/services/payments/types";

function buildQuery(filters: PaymentListFilters): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filters.status) query.status = filters.status;
  if (filters.provider) query.provider = filters.provider;
  if (filters.leadId) query.leadId = filters.leadId;
  if (filters.registrationId) query.registrationId = filters.registrationId;
  if (filters.opportunityId) query.opportunityId = filters.opportunityId;
  if (filters.campaignId) query.campaignId = filters.campaignId;
  if (filters.relatedEntityType) query.relatedEntityType = filters.relatedEntityType;
  if (filters.relatedEntityId) query.relatedEntityId = filters.relatedEntityId;
  if (filters.createdAfter || filters.createdBefore) {
    query.createdAt = {
      ...(filters.createdAfter ? { $gte: new Date(filters.createdAfter) } : {}),
      ...(filters.createdBefore ? { $lte: new Date(filters.createdBefore) } : {}),
    };
  }
  return query;
}

export const mongodbPaymentRepository: PaymentRepository = {
  async findById(id: string): Promise<Payment | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await PaymentModel.findById(id).exec();
    return doc ? toPayment(doc) : null;
  },

  async findByProviderOrderId(provider: PaymentProviderId, providerOrderId: string): Promise<Payment | null> {
    await getConnection();
    const doc = await PaymentModel.findOne({ provider, providerOrderId }).exec();
    return doc ? toPayment(doc) : null;
  },

  async create(input: CreatePaymentRecordInput): Promise<Payment> {
    await getConnection();
    const doc = await PaymentModel.create({ ...input, refundedAmountInSmallestUnit: 0 });
    return toPayment(doc);
  },

  async update(id: string, input: UpdatePaymentRecordInput): Promise<Payment> {
    await getConnection();
    const doc = await PaymentModel.findByIdAndUpdate(id, { $set: input }, { new: true }).exec();
    if (!doc) throw new Error(`Payment ${id} not found`);
    return toPayment(doc);
  },

  async list(filters: PaymentListFilters, page: number, limit: number): Promise<PaginatedResult<Payment>> {
    await getConnection();
    const query = buildQuery(filters);
    const [docs, total] = await Promise.all([
      PaymentModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      PaymentModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toPayment), total, { page, limit });
  },

  async findStalePending(olderThan: Date): Promise<Payment[]> {
    await getConnection();
    // "created" is the real non-terminal status a checkout session
    // starts in and normally stays in until a webhook (or this same
    // reconciler) resolves it — "pending" is kept in the type for a
    // future provider with a genuine intermediate processing state
    // (e.g. an async UPI collect flow), but no adapter here ever sets
    // it, so querying only "pending" would silently never match
    // anything real today.
    const docs = await PaymentModel.find({ status: { $in: ["created", "pending"] }, createdAt: { $lte: olderThan } }).exec();
    return docs.map(toPayment);
  },
};
