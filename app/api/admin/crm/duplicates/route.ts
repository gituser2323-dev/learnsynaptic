import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { leadService } from "@/lib/services/leads";

/**
 * GET /api/admin/crm/duplicates
 *
 * Enterprise CRM (Phase 1) — Duplicate Detection review queue. Groups
 * every Lead sharing a phone or email with at least one other Lead.
 * Unpaginated — dedup groups are inherently a small, bounded admin
 * cleanup queue, not a page-through list.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, RBAC (Admin/Manager/Counsellor).
 */
async function handleListDuplicates(): Promise<NextResponse> {
  const groups = await leadService.findDuplicates();
  return apiSuccess({ groups });
}

export const GET = withApiRoute("admin.crm.duplicates.list", handleListDuplicates, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});
