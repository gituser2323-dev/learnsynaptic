import { ForbiddenApiError, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { getConversationRepository } from "@/lib/db";
import { leadService } from "@/lib/services/leads";
import type { Conversation, ConversationListFilters } from "./types";

/**
 * Phase 2A — Conversations RBAC helpers.
 *
 * Mirrors the Leads list/detail pattern (counsellor self-scope;
 * manager/admin org-wide within the JWT tenant). Ownership is:
 *   conversation.assignedTo === caller
 *   OR linked lead.assignedCounsellorId === caller
 *
 * Never accept ownership filters from the client for counsellors —
 * force them server-side so a forged `assignedTo` query cannot widen
 * visibility.
 */

const LEAD_ID_PAGE_SIZE = 200;
const LEAD_ID_PAGE_CAP = 50;

export async function listCounsellorLeadIds(userId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= LEAD_ID_PAGE_CAP; page++) {
    const result = await leadService.listLeads({ assignedCounsellorId: userId }, page, LEAD_ID_PAGE_SIZE);
    for (const lead of result.items) ids.push(lead.id);
    if (result.items.length < LEAD_ID_PAGE_SIZE || ids.length >= result.total) break;
  }
  return ids;
}

export async function assertCanAccessConversation(
  ctx: ApiRouteContext,
  conversation: Conversation,
): Promise<void> {
  if (ctx.authContext.role !== "counsellor") return;

  const userId = ctx.authContext.userId;
  if (!userId) {
    throw new ForbiddenApiError("You can only access conversations for leads assigned to you.");
  }

  if (conversation.assignedTo === userId) return;

  if (conversation.leadId) {
    const lead = await leadService.getLead(conversation.leadId);
    if (lead?.assignedCounsellorId === userId) return;
  }

  throw new ForbiddenApiError("You can only access conversations for leads assigned to you.");
}

/** Load a conversation in the current tenant and enforce counsellor ownership. */
export async function requireAccessibleConversation(
  ctx: ApiRouteContext,
  conversationId: string,
): Promise<Conversation> {
  const repository = await getConversationRepository();
  const conversation = await repository.findById(conversationId);
  if (!conversation) throw new NotFoundApiError("Conversation", conversationId);
  await assertCanAccessConversation(ctx, conversation);
  return conversation;
}

/**
 * Apply list-scope for the caller. Counsellors get a forced ownership
 * filter; managers/admins keep client filters (including assignedTo).
 */
export async function scopeConversationListFilters(
  ctx: ApiRouteContext,
  filters: ConversationListFilters,
): Promise<ConversationListFilters> {
  if (ctx.authContext.role !== "counsellor") return filters;

  const userId = ctx.authContext.userId;
  if (!userId) {
    throw new ForbiddenApiError("You can only access conversations for leads assigned to you.");
  }

  const leadIds = await listCounsellorLeadIds(userId);
  return {
    ...filters,
    // Ignore any client-supplied assignedTo — ownership is forced below.
    assignedTo: undefined,
    ownershipScope: { userId, leadIds },
  };
}
