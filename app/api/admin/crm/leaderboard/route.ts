import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { leaderboardService } from "@/lib/services/crm/leaderboard";

/**
 * GET /api/admin/crm/leaderboard
 *
 * Enterprise CRM (Phase 1) — module 1.6's Counsellor Leaderboard:
 * conversion rate, average first-response time, and task
 * completion/turnaround per active staff member.
 *
 * ⚠️ requiredRole: "manager" — the blueprint's own carve-out for this
 * module ("manager rank sufficient for viewing the leaderboard," the
 * first real use of that tier). Deliberately not "admin" like every
 * other route in this module predating RBAC.
 */
async function handleGetLeaderboard(): Promise<NextResponse> {
  const result = await leaderboardService.getLeaderboard();
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.crm.leaderboard.get", handleGetLeaderboard, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});
