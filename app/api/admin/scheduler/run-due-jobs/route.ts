import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { runDueScheduledJobs } from "@/lib/services/scheduler";

/**
 * POST /api/admin/scheduler/run-due-jobs
 *
 * Manually triggers one poller tick of the shared scheduling
 * infrastructure (Campaign Architecture, approved decision 3) — an
 * admin's own "Run Due Jobs Now" button, for when a due job shouldn't
 * wait for the next real cron cycle. RC-3 wired the actual automatic
 * trigger separately: vercel.json's own five-minute-interval cron entry
 * hits app/api/cron/run-due-jobs (bearer-secret authenticated, not this
 * admin-authenticated route), which calls the exact same
 * runDueScheduledJobs() this route calls — one shared implementation,
 * two authenticated entry points. Processes every due job across every
 * registered job type in one call — the Automation Engine's "tick" and
 * WhatsApp Campaign Manager's message-send/promote-scheduled jobs all
 * flow through this same function, per the "single shared scheduling
 * infrastructure" requirement.
 *
 * ⚠️ requiredRole: "admin" — same fail-closed scoping as every other
 * admin route.
 */
async function handleRunDueJobs(): Promise<NextResponse> {
  const result = await runDueScheduledJobs();
  return apiSuccess({ ...result });
}

export const POST = withApiRoute("scheduler.run_due_jobs", handleRunDueJobs, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
