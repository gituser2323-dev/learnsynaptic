import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateWebhookDeliveryInput,
  WebhookDelivery,
  WebhookDeliveryListFilters,
  WebhookDeliveryRepository,
} from "@/lib/services/webhookMonitoring/types";

const store: WebhookDelivery[] = [];

export const inMemoryWebhookDeliveryRepository: WebhookDeliveryRepository = {
  async create(input: CreateWebhookDeliveryInput): Promise<WebhookDelivery> {
    const delivery: WebhookDelivery = stampTenant<WebhookDelivery>({ ...input, id: randomUUID(), receivedAt: new Date().toISOString() });
    store.push(delivery);
    return delivery;
  },

  async list(filters: WebhookDeliveryListFilters, page: number, limit: number): Promise<PaginatedResult<WebhookDelivery>> {
    let results = scopeToTenant(store);
    if (filters.source) results = results.filter((d) => d.source === filters.source);
    if (filters.outcome) results = results.filter((d) => d.outcome === filters.outcome);
    results.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },
};
