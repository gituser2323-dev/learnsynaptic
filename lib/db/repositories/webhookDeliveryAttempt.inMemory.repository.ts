import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateWebhookDeliveryAttemptInput,
  UpdateWebhookDeliveryAttemptInput,
  WebhookDeliveryAttempt,
  WebhookDeliveryAttemptRepository,
  WebhookDeliveryListFilters,
} from "@/lib/services/webhooks/types";

const store: WebhookDeliveryAttempt[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryWebhookDeliveryAttemptRepository: WebhookDeliveryAttemptRepository = {
  async findById(id: string): Promise<WebhookDeliveryAttempt | null> {
    return findOwnedByTenant(store, (a) => a.id === id) ?? null;
  },

  async create(input: CreateWebhookDeliveryAttemptInput): Promise<WebhookDeliveryAttempt> {
    const attempt: WebhookDeliveryAttempt = stampTenant<WebhookDeliveryAttempt>({ ...input, id: randomUUID(), createdAt: nowIso() });
    store.push(attempt);
    return attempt;
  },

  async update(id: string, input: UpdateWebhookDeliveryAttemptInput): Promise<WebhookDeliveryAttempt> {
    const attempt = findOwnedByTenant(store, (a) => a.id === id);
    if (!attempt) throw new Error(`WebhookDeliveryAttempt ${id} not found`);
    Object.assign(attempt, input);
    return attempt;
  },

  async list(filters: WebhookDeliveryListFilters, page: number, limit: number): Promise<PaginatedResult<WebhookDeliveryAttempt>> {
    let results = scopeToTenant(store);
    if (filters.endpointId) results = results.filter((a) => a.endpointId === filters.endpointId);
    if (filters.outcome) results = results.filter((a) => a.outcome === filters.outcome);
    if (filters.eventType) results = results.filter((a) => a.eventType === filters.eventType);
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },
};
