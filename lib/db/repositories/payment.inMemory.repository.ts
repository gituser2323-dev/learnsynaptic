import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreatePaymentRecordInput,
  Payment,
  PaymentListFilters,
  PaymentProviderId,
  PaymentRepository,
  UpdatePaymentRecordInput,
} from "@/lib/services/payments/types";

const store: Payment[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryPaymentRepository: PaymentRepository = {
  async findById(id: string): Promise<Payment | null> {
    return findOwnedByTenant(store, (p) => p.id === id) ?? null;
  },

  async findByProviderOrderId(provider: PaymentProviderId, providerOrderId: string): Promise<Payment | null> {
    return scopeToTenant(store).find((p) => p.provider === provider && p.providerOrderId === providerOrderId) ?? null;
  },

  async create(input: CreatePaymentRecordInput): Promise<Payment> {
    const payment: Payment = stampTenant({ ...input, id: randomUUID(), refundedAmountInSmallestUnit: 0, createdAt: nowIso(), updatedAt: nowIso() });
    store.push(payment);
    return payment;
  },

  async update(id: string, input: UpdatePaymentRecordInput): Promise<Payment> {
    const payment = findOwnedByTenant(store, (p) => p.id === id);
    if (!payment) throw new Error(`Payment ${id} not found`);
    Object.assign(payment, input, { updatedAt: nowIso() });
    return payment;
  },

  async list(filters: PaymentListFilters, page: number, limit: number): Promise<PaginatedResult<Payment>> {
    let results = scopeToTenant(store);
    if (filters.status) results = results.filter((p) => p.status === filters.status);
    if (filters.provider) results = results.filter((p) => p.provider === filters.provider);
    if (filters.leadId) results = results.filter((p) => p.leadId === filters.leadId);
    if (filters.registrationId) results = results.filter((p) => p.registrationId === filters.registrationId);
    if (filters.opportunityId) results = results.filter((p) => p.opportunityId === filters.opportunityId);
    if (filters.campaignId) results = results.filter((p) => p.campaignId === filters.campaignId);
    if (filters.relatedEntityType) results = results.filter((p) => p.relatedEntityType === filters.relatedEntityType);
    if (filters.relatedEntityId) results = results.filter((p) => p.relatedEntityId === filters.relatedEntityId);
    if (filters.createdAfter) results = results.filter((p) => p.createdAt >= filters.createdAfter!);
    if (filters.createdBefore) results = results.filter((p) => p.createdAt <= filters.createdBefore!);
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async findStalePending(olderThan: Date): Promise<Payment[]> {
    // See the mongodb repository's own doc comment: "created" is the
    // real non-terminal status in use today; "pending" is matched too
    // for forward-compatibility with a future provider that sets it.
    return store.filter((p) => (p.status === "created" || p.status === "pending") && new Date(p.createdAt).getTime() <= olderThan.getTime());
  },
};
