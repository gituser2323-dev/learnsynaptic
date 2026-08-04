import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams } from "@/lib/api";
import { webhookMonitoringService } from "@/lib/services/webhookMonitoring";
import type { WebhookDeliveryListFilters } from "@/lib/services/webhookMonitoring";

/**
 * GET /api/admin/webhook-deliveries
 *
 * WhatsApp Platform (Phase 2), Module 2.4 — Settings → Integrations'
 * webhook delivery log. Read-only — deliveries are written only from
 * inside a webhook route itself (see app/api/webhooks/whatsapp/route.ts),
 * never via this route.
 *
 * ⚠️ requiredRole: "admin" — operational/security visibility, same
 * tier as Audit Logs and Environment Configuration on the Settings page.
 */
async function handleListWebhookDeliveries(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filters: WebhookDeliveryListFilters = {
    source: searchParams.get("source") || undefined,
    outcome: (searchParams.get("outcome") as WebhookDeliveryListFilters["outcome"]) || undefined,
  };

  const { page, limit } = parsePaginationParams(searchParams);
  const result = await webhookMonitoringService.listDeliveries(filters, page, limit);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.webhook_deliveries.list", handleListWebhookDeliveries, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
