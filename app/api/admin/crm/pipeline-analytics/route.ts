import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { pipelineAnalyticsService } from "@/lib/services/crm/pipelineAnalytics";

/**
 * GET /api/admin/crm/pipeline-analytics
 *
 * Enterprise Analytics (Phase 7) — module 7.1's Counsellor & Pipeline
 * Analytics: per-counsellor opportunity/win-rate/pipeline-value
 * breakdowns and per-pipeline stage funnels (entered count, conversion
 * from the first stage, average completed time-in-stage).
 *
 * requiredRole: "manager" — same tier as module 1.6's Leaderboard
 * (app/api/admin/crm/leaderboard/route.ts), which this module is
 * presented alongside on the Analytics page. No counsellor
 * self-scoping: unlike Leads/Tasks, this route always returns every
 * counsellor's figures to any manager+ caller, matching the
 * Leaderboard's own precedent exactly.
 */
async function handleGetPipelineAnalytics(): Promise<NextResponse> {
  const result = await pipelineAnalyticsService.getPipelineAnalytics();
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.crm.pipelineAnalytics.get", handleGetPipelineAnalytics, {
  requiredRole: "manager",
  rateLimit: { limit: 30, windowMs: 60_000 },
});
