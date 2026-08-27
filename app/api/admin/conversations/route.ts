import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import {
  conversationService,
  scopeConversationListFilters,
} from "@/lib/services/conversations";
import type { ConversationChannel, ConversationListFilters, ConversationStatus } from "@/lib/services/conversations";

/**
 * GET /api/admin/conversations
 *
 * WhatsApp Platform (Phase 2) — the inbox list: every conversation,
 * reverse-chronological by last message, filterable by channel/status/
 * assignee/label/contact search.
 *
 * Phase 2A — requiredRole counsellor. Counsellors are force-scoped to
 * conversations they own (assignedTo or linked lead.assignedCounsellorId),
 * matching GET /api/admin/leads. Managers/admins see the org-wide list.
 */
async function handleListConversations(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filters: ConversationListFilters = {
    channel: (searchParams.get("channel") as ConversationChannel) || undefined,
    status: (searchParams.get("status") as ConversationStatus) || undefined,
    assignedTo: searchParams.get("assignedTo") || undefined,
    label: searchParams.get("label") || undefined,
    search: searchParams.get("search") || undefined,
  };
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;

  const scoped = await scopeConversationListFilters(ctx, filters);
  const result = await conversationService.listConversations(scoped, page, limit);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.conversations.list", handleListConversations, {
  requiredRole: "counsellor",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
