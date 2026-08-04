import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { phoneNumberService } from "@/lib/services/whatsapp/phoneNumbers";

/**
 * GET /api/admin/whatsapp/phone-health
 *
 * WhatsApp Platform (Phase 2), Module 2.3 — Settings → WhatsApp
 * Provider panel's live status. Read-only — populated only by the
 * scheduled whatsapp.phone_health_check job (see
 * lib/services/whatsapp/schedulerIntegration.ts), never written from
 * this route.
 *
 * ⚠️ requiredRole: "admin" — same tier as the rest of Environment
 * Configuration on the Settings page.
 */
async function handleGetPhoneHealth(): Promise<NextResponse> {
  const phoneNumbers = await phoneNumberService.listPhoneNumbers();
  return apiSuccess({ phoneNumbers });
}

export const GET = withApiRoute("admin.whatsapp.phone_health.get", handleGetPhoneHealth, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
