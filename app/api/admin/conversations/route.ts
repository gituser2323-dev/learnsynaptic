import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { conversationService } from "@/lib/services/conversations";
import type { ConversationChannel, ConversationListFilters, ConversationStatus } from "@/lib/services/conversations";

/**
 * GET /api/admin/conversations
 *
 * WhatsApp Platform (Phase 2) — the inbox list: every conversation,
 * reverse-chronological by last message, filterable by channel/status/
 * assignee/label/contact search.
 *
 * ⚠️ requiredRole: "admin" — per the approved Blueprint's own spec for
 * this module; unlike Phase 1, no RBAC broadening was requested here.
 */
async function handleListConversations(request: Request): Promise<NextResponse> {
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

  const result = await conversationService.listConversations(filters, page, limit);
  return apiSuccess({ ...result });
}

export const GET = withApiRoute("admin.conversations.list", handleListConversations, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
