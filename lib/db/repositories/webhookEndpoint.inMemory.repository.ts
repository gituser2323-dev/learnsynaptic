import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  WebhookEndpoint,
  WebhookEndpointListFilters,
  WebhookEndpointRepository,
} from "@/lib/services/webhooks/types";

const store: WebhookEndpoint[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryWebhookEndpointRepository: WebhookEndpointRepository = {
  async findById(id: string): Promise<WebhookEndpoint | null> {
    return findOwnedByTenant(store, (e) => e.id === id) ?? null;
  },

  async create(input: CreateWebhookEndpointInput): Promise<WebhookEndpoint> {
    const endpoint: WebhookEndpoint = stampTenant<WebhookEndpoint>({
      ...input,
      id: randomUUID(),
      status: "active",
      consecutiveFailures: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(endpoint);
    return endpoint;
  },

  async update(id: string, input: UpdateWebhookEndpointInput): Promise<WebhookEndpoint> {
    const endpoint = findOwnedByTenant(store, (e) => e.id === id);
    if (!endpoint) throw new Error(`WebhookEndpoint ${id} not found`);
    Object.assign(endpoint, input, { updatedAt: nowIso() });
    return endpoint;
  },

  async list(filters: WebhookEndpointListFilters, page: number, limit: number): Promise<PaginatedResult<WebhookEndpoint>> {
    let results = scopeToTenant(store);
    if (filters.status) results = results.filter((e) => e.status === filters.status);
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async listActive(): Promise<WebhookEndpoint[]> {
    return scopeToTenant(store).filter((e) => e.status === "active");
  },
};
