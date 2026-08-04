import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { autoReplyService } from "@/lib/services/automation";

/**
 * GET /api/admin/automation/auto-reply-rules, POST /api/admin/automation/auto-reply-rules
 *
 * Automation Platform (Phase 3), Module 3.3 — keyword-matched auto-reply
 * rules for inbound WhatsApp messages, plus an optional fallback rule.
 * See lib/services/automation/autoReply/types.ts for the matching model.
 *
 * ⚠️ requiredRole: "admin" — same blast-radius reasoning as
 * /api/admin/automation/definitions: a rule change here affects what
 * real inbound conversations receive automatically.
 */
async function handleListRules(): Promise<NextResponse> {
  const rules = await autoReplyService.listAutoReplyRules();
  return apiSuccess({ rules });
}

async function handleCreateRule(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  const result = await autoReplyService.createAutoReplyRule(body, {
    requestId: ctx.requestId,
    actorId: ctx.authContext.userId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ rule: result.rule }, 201);
}

export const GET = withApiRoute("admin.automation.autoReplyRules.list", handleListRules, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.automation.autoReplyRules.create", handleCreateRule, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});
