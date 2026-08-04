import { getWebhookDeliveryRepository } from "@/lib/db";
import { getTenantContext } from "@/lib/tenancy/context";
import { ensureDefaultOrganization } from "@/lib/services/organizations";
import type { PaginatedResult } from "@/lib/pagination";
import type { CreateWebhookDeliveryInput, WebhookDelivery, WebhookDeliveryListFilters } from "./types";

/**
 * Module 2.4 — Webhook & API Monitoring. Deliberately a thin,
 * fire-and-forget-shaped service: `logDelivery` is called from inside
 * the WhatsApp webhook route itself (see
 * app/api/webhooks/whatsapp/route.ts), which must still respond to Meta
 * quickly regardless of whether this write succeeds — a failure here
 * should never turn a real webhook delivery into a 500.
 */
export const webhookMonitoringService = {
  async logDelivery(input: CreateWebhookDeliveryInput): Promise<WebhookDelivery> {
    const repository = await getWebhookDeliveryRepository();
    // Business OS Phase 8, Module 8.1 — an inbound webhook POST is
    // unauthenticated by design (a provider's own servers have no
    // LearnSynaptic session — see webhookDelivery.model.ts's own doc
    // comment), so there's no tenant context to stamp this from
    // automatically the way withApiRoute.ts does for authenticated
    // routes. Resolves to the deployment's one default organization —
    // the same "single real connected account today" posture
    // leadService.registerLead()'s own doc comment establishes for
    // public Lead capture — so an admin's own now-tenant-scoped
    // Settings → Integrations view can actually see it, rather than a
    // real delivery silently vanishing the moment this module ships.
    const organizationId = getTenantContext()?.organizationId ?? (await ensureDefaultOrganization()).id;
    return repository.create({ ...input, organizationId });
  },

  async listDeliveries(
    filters: WebhookDeliveryListFilters,
    page = 1,
    limit = 25,
  ): Promise<PaginatedResult<WebhookDelivery>> {
    const repository = await getWebhookDeliveryRepository();
    return repository.list(filters, page, limit);
  },
};
