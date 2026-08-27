import { describe, it, expect } from "vitest";
import { ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { leadService } from "@/lib/services/leads";
import { conversationService } from "./conversationService";
import {
  assertCanAccessConversation,
  scopeConversationListFilters,
} from "./conversationAccess";
import type { Conversation } from "./types";

function ctx(role: "counsellor" | "manager" | "admin", userId: string): ApiRouteContext {
  return {
    params: {},
    requestId: "unit-test",
    authContext: { userId, role, email: `${role}@test.local` },
  } as ApiRouteContext;
}

describe("conversationAccess — Phase 2A RBAC", () => {
  it("manager and admin skip ownership checks", async () => {
    const conversation = {
      id: "c1",
      channel: "whatsapp",
      status: "open",
      labels: [],
      unreadCount: 0,
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Conversation;

    await expect(assertCanAccessConversation(ctx("manager", "mgr-1"), conversation)).resolves.toBeUndefined();
    await expect(assertCanAccessConversation(ctx("admin", "adm-1"), conversation)).resolves.toBeUndefined();
  });

  it("counsellor is denied when neither assignedTo nor lead ownership matches", async () => {
    const conversation = {
      id: "c2",
      channel: "whatsapp",
      status: "open",
      labels: [],
      unreadCount: 0,
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: "other-counsellor",
    } satisfies Conversation;

    await expect(assertCanAccessConversation(ctx("counsellor", "self"), conversation)).rejects.toBeInstanceOf(
      ForbiddenApiError,
    );
  });

  it("counsellor is allowed when conversation.assignedTo matches", async () => {
    const conversation = {
      id: "c3",
      channel: "email",
      status: "open",
      labels: [],
      unreadCount: 0,
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: "self",
    } satisfies Conversation;

    await expect(assertCanAccessConversation(ctx("counsellor", "self"), conversation)).resolves.toBeUndefined();
  });

  it("counsellor is allowed via linked lead.assignedCounsellorId and list scope forces ownership", async () => {
    const org = `org-conv-rbac-${Date.now()}`;
    const counsellorId = `counsellor-${Date.now()}`;

    await runWithTenantContext({ organizationId: org }, async () => {
      const created = await leadService.registerLead({
        name: "RBAC Lead",
        email: `rbac-${Date.now()}@example.com`,
        phone: `+9199${String(Date.now()).slice(-8)}`,
        source: "manual",
      });
      if (!created.success || !created.lead) throw new Error("lead create failed");
      const leadId = created.lead.id;
      await leadService.updateLead(leadId, { assignedCounsellorId: counsellorId });

      const conversation = await conversationService.getOrCreateForContact(
        `+9198${String(Date.now()).slice(-8)}`,
        "whatsapp",
        "RBAC Contact",
      );
      // Link lead the same way inbound matching would.
      const { getConversationRepository } = await import("@/lib/db");
      const repo = await getConversationRepository();
      await repo.update(conversation.id, { leadId });

      const linked = await repo.findById(conversation.id);
      expect(linked?.leadId).toBe(leadId);
      await expect(assertCanAccessConversation(ctx("counsellor", counsellorId), linked!)).resolves.toBeUndefined();
      await expect(assertCanAccessConversation(ctx("counsellor", "someone-else"), linked!)).rejects.toBeInstanceOf(
        ForbiddenApiError,
      );

      const scoped = await scopeConversationListFilters(ctx("counsellor", counsellorId), {
        assignedTo: "forged-attacker-id",
      });
      expect(scoped.assignedTo).toBeUndefined();
      expect(scoped.ownershipScope?.userId).toBe(counsellorId);
      expect(scoped.ownershipScope?.leadIds).toContain(leadId);

      const listed = await conversationService.listConversations(scoped, 1, 50);
      expect(listed.items.some((c) => c.id === conversation.id)).toBe(true);
    });
  });
});
