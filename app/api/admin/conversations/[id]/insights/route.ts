import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parsePaginationParams, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { conversationInsightService } from "@/lib/services/conversations/insights";

/**
 * GET /api/admin/conversations/[id]/insights, POST /api/admin/conversations/[id]/insights
 *
 * AI CRM (Phase 5), Module 5.3 — GET returns this conversation's
 * analysis history (newest first); POST is the manual "Analyze Again"
 * trigger. Both always return 200 with a real ConversationInsight row
 * even when AI is unavailable or the vendor call failed (status:
 * "unavailable"/"error") — the same graceful-degradation contract
 * 5.1/5.2's own routes established, never turning "no AI provider
 * configured" into an error response.
 *
 * ⚠️ requiredRole: "admin" — same tier as every other Conversations
 * route (see app/api/admin/conversations/[id]/messages/route.ts).
 */
async function handleListInsights(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const { searchParams } = new URL(request.url);
  const { page, limit } = parsePaginationParams(searchParams);
  const result = await conversationInsightService.listInsights(id, page, limit);
  return apiSuccess({ ...result });
}

async function handleAnalyzeConversation(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const insight = await conversationInsightService.analyzeConversation(id, {
    trigger: "manual",
    actorId: ctx.authContext.userId,
    requestId: ctx.requestId,
  });
  if (!insight) throw new NotFoundApiError("Conversation", id);
  return apiSuccess({ insight }, 201);
}

export const GET = withApiRoute("admin.conversations.insights.list", handleListInsights, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.conversations.insights.analyze", handleAnalyzeConversation, {
  requiredRole: "admin",
  // AI vendor calls are slow and costed per-call — same tighter limit
  // 5.1/5.2's own analyze routes use.
  rateLimit: { limit: 10, windowMs: 60_000 },
});
