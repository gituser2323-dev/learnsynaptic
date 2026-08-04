import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, UnauthorizedApiError } from "@/lib/api";
import { isValidCronRequest } from "@/lib/api/verifyCronSecret";
import { runDueScheduledJobs } from "@/lib/services/scheduler";

/**
 * GET /api/cron/run-due-jobs
 *
 * Phase 0 (Business OS Architecture Audit) — the wiring point that was
 * always missing: app/api/admin/scheduler/run-due-jobs/route.ts's own
 * doc comment already named this exact gap ("no cron/scheduler
 * infrastructure exists anywhere in this app"). Three pollers were
 * fully built and correct before this route existed — the automation
 * engine's step runner, the WhatsApp campaign scheduler, the campaign
 * message queue — and none of them fired on their own; only a human
 * clicking "Run Due Jobs Now" in the admin UI ever advanced them.
 *
 * This route is a thin, deliberately separate sibling of the existing
 * admin route — not a replacement. The admin route stays exactly as it
 * was (JWT-cookie admin auth, still backs the manual "Run Due Jobs Now"
 * button); this one is outside middleware.ts's matcher entirely (see
 * middleware.ts's own matcher list — /api/cron/:path* is deliberately
 * not in it) and authenticates via a bearer secret instead, since a
 * cron trigger carries no browser session. GET, not POST — Vercel Cron
 * always triggers via GET.
 *
 * Both routes call the same runDueScheduledJobs() — one production
 * driver (this one, on a schedule) plus one manual/debugging entry
 * point (the admin one), never two different implementations of the
 * same job-draining logic.
 */
async function handleCronRunDueJobs(request: Request): Promise<NextResponse> {
  if (!isValidCronRequest(request)) {
    throw new UnauthorizedApiError([
      { field: "root", message: "This endpoint only accepts authenticated scheduler requests." },
    ]);
  }

  const result = await runDueScheduledJobs();
  return apiSuccess({ ...result });
}

// No requiredRole — this route is intentionally outside the admin JWT
// model; isValidCronRequest() above is the entire auth check. A generous
// rate limit here is just a sanity backstop against a misconfigured
// scheduler retriggering in a tight loop, not a meaningful security
// boundary (the bearer-secret check already is one).
export const GET = withApiRoute("cron.run_due_jobs", handleCronRunDueJobs, {
  rateLimit: { limit: 30, windowMs: 60_000 },
});
