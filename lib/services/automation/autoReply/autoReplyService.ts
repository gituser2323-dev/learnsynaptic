import { getAutoReplyRuleRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { conversationService } from "@/lib/services/conversations";
import { createLogger } from "@/lib/logger";
import {
  validateCreateAutoReplyRuleInput,
  validateUpdateAutoReplyRuleInput,
  type AutoReplyRuleValidationError,
} from "./validation";
import type { AutoReplyRule } from "./types";

const logger = createLogger({ service: "automation.autoReply" });

export type CreateAutoReplyRuleResult =
  | { success: true; rule: AutoReplyRule }
  | { success: false; errors: AutoReplyRuleValidationError[] };

export type UpdateAutoReplyRuleResult =
  | { success: true; rule: AutoReplyRule }
  | { success: false; errors: AutoReplyRuleValidationError[] };

export const autoReplyService = {
  async listAutoReplyRules(): Promise<AutoReplyRule[]> {
    const repository = await getAutoReplyRuleRepository();
    return repository.list();
  },

  async getAutoReplyRule(id: string): Promise<AutoReplyRule | null> {
    const repository = await getAutoReplyRuleRepository();
    return repository.findById(id);
  },

  async createAutoReplyRule(input: unknown, context: AuditContext = {}): Promise<CreateAutoReplyRuleResult> {
    const validation = validateCreateAutoReplyRuleInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const repository = await getAutoReplyRuleRepository();
    const rule = await repository.create(validation.data);
    await auditLogService.record({
      action: AUDIT_ACTIONS.AUTO_REPLY_RULE_CREATED,
      entityType: "AutoReplyRule",
      entityId: rule.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { isFallback: rule.isFallback, keywordCount: rule.keywords.length },
    });
    return { success: true, rule };
  },

  async updateAutoReplyRule(id: string, input: unknown, context: AuditContext = {}): Promise<UpdateAutoReplyRuleResult> {
    const repository = await getAutoReplyRuleRepository();
    const existing = await repository.findById(id);
    if (!existing) return { success: false, errors: [{ field: "id", message: `Auto-reply rule ${id} not found.` }] };

    const validation = validateUpdateAutoReplyRuleInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    // Cross-field check that needs the existing record — see
    // validation.ts's own comment on why it isn't checked there.
    const willBeFallback = validation.data.isFallback ?? existing.isFallback;
    const willHaveKeywords = validation.data.keywords ?? existing.keywords;
    if (!willBeFallback && willHaveKeywords.length === 0) {
      return {
        success: false,
        errors: [{ field: "keywords", message: "At least one keyword is required for a non-fallback rule." }],
      };
    }

    const rule = await repository.update(id, validation.data);
    await auditLogService.record({
      action: AUDIT_ACTIONS.AUTO_REPLY_RULE_UPDATED,
      entityType: "AutoReplyRule",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { patchedFields: Object.keys(validation.data) },
    });
    return { success: true, rule };
  },

  async deleteAutoReplyRule(id: string, context: AuditContext = {}): Promise<void> {
    const repository = await getAutoReplyRuleRepository();
    await repository.delete(id);
    await auditLogService.record({
      action: AUDIT_ACTIONS.AUTO_REPLY_RULE_DELETED,
      entityType: "AutoReplyRule",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
    });
  },

  /** Pure matcher, exported separately from the DB-driven handler below
   *  so it's unit-testable without a repository. Keyword rules are
   *  checked first, in list order (oldest first) — the first rule with
   *  any keyword appearing as a case-insensitive substring of `body`
   *  wins. If none match, the first active fallback rule (if any) is
   *  returned. `body` is treated as empty for non-text inbound content
   *  (media-only messages, etc.) — it can still trigger the fallback. */
  matchAutoReply(body: string, activeRules: AutoReplyRule[]): AutoReplyRule | undefined {
    const normalizedBody = body.toLowerCase();
    const keywordMatch = activeRules.find(
      (rule) => !rule.isFallback && rule.keywords.some((keyword) => normalizedBody.includes(keyword.toLowerCase())),
    );
    if (keywordMatch) return keywordMatch;
    return activeRules.find((rule) => rule.isFallback);
  },

  /** triggers.ts's "message.received" subscriber. Sends through
   *  conversationService.sendReply() — the same primitive the admin
   *  thread-view UI uses for a manual reply — so an auto-reply shows up
   *  in the thread and delivery tracking identically to one a human
   *  sent. Errors are logged, not rethrown: a failed auto-reply
   *  shouldn't be treated as a fatal event-handling failure (the
   *  inbound message itself was already recorded successfully by the
   *  time this fires), matching lib/events/eventBus.ts's own
   *  "a handler's failure never blocks other handlers" posture — this
   *  is that same posture applied one level down, explicitly, rather
   *  than relying on the event bus's generic catch to do it silently. */
  async handleInboundMessage(payload: { conversationId: string; messageId: string; body?: string }): Promise<void> {
    const repository = await getAutoReplyRuleRepository();
    const activeRules = await repository.listActive();
    if (activeRules.length === 0) return;

    const rule = this.matchAutoReply(payload.body ?? "", activeRules);
    if (!rule) return;

    try {
      await conversationService.sendReply(payload.conversationId, { type: "text", body: rule.replyText });
      logger.info("automation.auto_reply_sent", {
        conversationId: payload.conversationId,
        ruleId: rule.id,
        isFallback: rule.isFallback,
      });
    } catch (error) {
      logger.error("automation.auto_reply_failed", {
        conversationId: payload.conversationId,
        ruleId: rule.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
