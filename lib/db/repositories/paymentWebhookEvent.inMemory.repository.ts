import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import { DuplicateKeyError } from "@/lib/db/types";
import type {
  CreatePaymentWebhookEventInput,
  PaymentProviderId,
  PaymentWebhookEvent,
  PaymentWebhookEventListFilters,
  PaymentWebhookEventRepository,
  PaymentWebhookOutcome,
} from "@/lib/services/payments/types";

const store: PaymentWebhookEvent[] = [];

/** Mirrors the mongodb model's own partial unique index exactly — see
 *  paymentWebhookEvent.model.ts's own doc comment on why uniqueness
 *  only applies to these three "a claim exists" outcomes, never to
 *  "duplicate" (allowed to repeat freely) or the pre-claim outcomes. */
const CLAIM_OUTCOMES: readonly PaymentWebhookOutcome[] = ["processing", "processed", "error"];

export const inMemoryPaymentWebhookEventRepository: PaymentWebhookEventRepository = {
  async create(input: CreatePaymentWebhookEventInput): Promise<PaymentWebhookEvent> {
    if (
      input.providerEventId &&
      CLAIM_OUTCOMES.includes(input.outcome) &&
      store.some((e) => e.provider === input.provider && e.providerEventId === input.providerEventId && CLAIM_OUTCOMES.includes(e.outcome))
    ) {
      throw new DuplicateKeyError("PaymentWebhookEvent", { provider: input.provider, providerEventId: input.providerEventId });
    }
    const event: PaymentWebhookEvent = stampTenant<PaymentWebhookEvent>({ ...input, id: randomUUID(), receivedAt: new Date().toISOString() });
    store.push(event);
    return event;
  },

  async findByProviderEventId(provider: PaymentProviderId, providerEventId: string): Promise<PaymentWebhookEvent | null> {
    return scopeToTenant(store).find((e) => e.provider === provider && e.providerEventId === providerEventId) ?? null;
  },

  async updateOutcome(id: string, patch: { outcome: PaymentWebhookOutcome; detail?: string }): Promise<PaymentWebhookEvent> {
    const event = store.find((e) => e.id === id);
    if (!event) throw new Error(`PaymentWebhookEvent ${id} not found`);
    Object.assign(event, patch);
    return event;
  },

  async list(filters: PaymentWebhookEventListFilters, page: number, limit: number): Promise<PaginatedResult<PaymentWebhookEvent>> {
    let results = scopeToTenant(store);
    if (filters.provider) results = results.filter((e) => e.provider === filters.provider);
    if (filters.outcome) results = results.filter((e) => e.outcome === filters.outcome);
    results.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },
};
