import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { autoReplyService } from "@/lib/services/automation";

/**
 * GET/PATCH/DELETE /api/admin/automation/auto-reply-rules/[id]
 *
 * Automation Platform (Phase 3), Module 3.3. PATCH is a partial update —
 * keywords/replyText/isFallback/active are each independently optional.
 * DELETE is unconditional (no in-flight "run" concept exists for a rule
 * the way it does for a WorkflowDefinition — a rule is either matched
 * against the next inbound message or it isn't).
 *
 * ⚠️ requiredRole: "admin" — same blast-radius reasoning as the
 * collection route.
 */
async function handleGetRule(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const rule = await autoReplyService.getAutoReplyRule(id);
  if (!rule) throw new NotFoundApiError("AutoReplyRule", id);
  return apiSuccess({ rule });
}

async function handleUpdateRule(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = await parseJsonBody(request);
  const result = await autoReplyService.updateAutoReplyRule(id, body, {
    requestId: ctx.requestId,
    actorId: ctx.authContext.userId,
  });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ rule: result.rule });
}

async function handleDeleteRule(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const existing = await autoReplyService.getAutoReplyRule(id);
  if (!existing) throw new NotFoundApiError("AutoReplyRule", id);

  await autoReplyService.deleteAutoReplyRule(id, { requestId: ctx.requestId, actorId: ctx.authContext.userId });
  return apiSuccess({ deleted: true });
}

export const GET = withApiRoute("admin.automation.autoReplyRules.get", handleGetRule, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const PATCH = withApiRoute("admin.automation.autoReplyRules.update", handleUpdateRule, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});

export const DELETE = withApiRoute("admin.automation.autoReplyRules.delete", handleDeleteRule, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});
