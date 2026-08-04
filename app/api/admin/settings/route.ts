import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { getSettingsSnapshot } from "@/lib/services/settings";

/**
 * GET /api/admin/settings
 *
 * Admin Dashboard — Settings page. Read-only snapshot of active
 * configuration across every provider-backed module (WhatsApp, Campaign
 * Manager, Marketing, Database, Audit Log retention, Auth) — see
 * lib/services/settings/settingsService.ts. Booleans and non-secret
 * numbers only; never returns an actual API key, token, or secret.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleGetSettings(): Promise<NextResponse> {
  return apiSuccess({ settings: getSettingsSnapshot() });
}

export const GET = withApiRoute("admin.settings.get", handleGetSettings, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
