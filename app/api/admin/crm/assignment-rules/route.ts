import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import { assignmentService } from "@/lib/services/crm/assignment";
import type { AssignmentStrategy } from "@/lib/services/crm/assignment";

/**
 * GET /api/admin/crm/assignment-rules, POST /api/admin/crm/assignment-rules
 *
 * Enterprise CRM (Phase 1) — Lead Assignment configuration. One active
 * rule at a time (see assignmentRule.model.ts); POST replaces whichever
 * rule is currently active. "Manual Assignment" is simply not having a
 * round_robin rule active — there's no separate "manual mode" record.
 *
 * ⚠️ requiredRole: "manager" — CRM configuration/management, RBAC (Admin/Manager/Counsellor).
 */
async function handleGetActiveRule(): Promise<NextResponse> {
  const rule = await assignmentService.getActiveRule();
  return apiSuccess({ rule });
}

async function handleSetRule(request: Request): Promise<NextResponse> {
  const body = (await parseJsonBody(request)) as { strategy?: AssignmentStrategy; counsellorIds?: string[] };
  if (!body.strategy || (body.strategy === "round_robin" && (!body.counsellorIds || body.counsellorIds.length === 0))) {
    throw new ValidationApiError([
      { field: "counsellorIds", message: "Round robin requires at least one counsellor." },
    ]);
  }

  const rule = await assignmentService.setRule({ strategy: body.strategy, counsellorIds: body.counsellorIds ?? [] });
  return apiSuccess({ rule }, 201);
}

export const GET = withApiRoute("admin.crm.assignment_rules.get", handleGetActiveRule, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.crm.assignment_rules.set", handleSetRule, {
  requiredRole: "manager",
  rateLimit: { limit: 20, windowMs: 60_000 },
});
