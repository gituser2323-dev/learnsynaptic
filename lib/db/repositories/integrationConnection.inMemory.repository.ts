import { randomUUID } from "crypto";
import { scopeToTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateIntegrationConnectionInput,
  IntegrationConnection,
  IntegrationConnectionRepository,
  UpdateIntegrationConnectionInput,
} from "@/lib/services/integrations/types";

const store: IntegrationConnection[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryIntegrationConnectionRepository: IntegrationConnectionRepository = {
  // Business OS Phase 8, Module 8.1 — providerId is now unique PER
  // TENANT, not globally (see integrationConnection.model.ts's own
  // updated index): two organizations each connecting their own
  // Razorpay account is the whole point of this module. Scoped to the
  // active tenant before matching on providerId.
  async findByProviderId(providerId: string): Promise<IntegrationConnection | null> {
    return scopeToTenant(store).find((c) => c.providerId === providerId) ?? null;
  },

  async list(): Promise<IntegrationConnection[]> {
    return scopeToTenant(store);
  },

  async create(input: CreateIntegrationConnectionInput): Promise<IntegrationConnection> {
    const connection: IntegrationConnection = stampTenant({
      id: randomUUID(),
      providerId: input.providerId,
      status: "connected",
      enabled: true,
      config: input.config ?? {},
      credentialRef: input.credentialRef ?? { type: "none" },
      health: "unknown",
      organizationId: input.organizationId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(connection);
    return connection;
  },

  async update(providerId: string, input: UpdateIntegrationConnectionInput): Promise<IntegrationConnection> {
    const connection = scopeToTenant(store).find((c) => c.providerId === providerId);
    if (!connection) throw new Error(`IntegrationConnection for provider "${providerId}" not found`);
    Object.assign(connection, input, { updatedAt: nowIso() });
    return connection;
  },
};
