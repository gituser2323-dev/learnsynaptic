import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";

/**
 * GET /api/admin/integrations
 *
 * Integrations Hub (Phase 6), Module 6.1 — every known provider (the
 * static catalog), merged with its live connection/health state: read-
 * only reflection for the three builtIn providers (WhatsApp/Email/AI —
 * their own env config, never a second source of truth), full
 * registry-tracked lifecycle state for everything else. Never returns
 * a raw credential value — `credentialRef` is a pointer
 * ("env"/"vault"/"none"), never the secret itself.
 *
 * ⚠️ requiredRole: "admin" — same tier as Webhook Deliveries and
 * Environment Configuration on the Settings page (operational/security
 * visibility, not a CRM-configuration concern a Manager needs).
 */
async function handleListIntegrations(): Promise<NextResponse> {
  const integrations = await integrationService.listIntegrations();
  return apiSuccess({ integrations });
}

export const GET = withApiRoute("admin.integrations.list", handleListIntegrations, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
