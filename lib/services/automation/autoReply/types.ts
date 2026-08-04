/**
 * Business OS Phase 3, Module 3.3 — Auto-Reply Engine.
 *
 * Deliberately NOT built on top of WorkflowDefinition/WorkflowRun
 * (Module 3.1): that engine models multi-day, per-Lead sequences with
 * persisted delay/retry state — an auto-reply is an immediate,
 * synchronous reaction to one inbound message, keyed by Conversation,
 * not Lead. Forcing it through WorkflowContext's entityType/entityId
 * shape would be the wrong fit for the wrong reason (reuse for its own
 * sake). Instead this is its own small rule catalog, matched directly
 * from triggers.ts's "message.received" subscription, sending through
 * conversationService.sendReply() — the same primitive the admin
 * thread-view UI already uses for a manual reply.
 *
 * Matching model (confirmed with the product owner before building):
 * keyword rules, case-insensitive substring match against the inbound
 * message body, evaluated in list order (oldest rule first) — plus an
 * optional fallback rule that fires when no keyword rule matches.
 * Deliberately no per-conversation cooldown/rate-limit in this pass —
 * a contact sending several messages in quick succession gets a reply
 * to each; disclosed as a known limitation, not a hidden gap.
 */

export interface AutoReplyRule {
  id: string;
  /** Ignored when isFallback is true. Non-empty, case-insensitive
   *  substring match against the inbound message body. */
  keywords: string[];
  replyText: string;
  /** Fires when no keyword rule matches. At most one fallback rule is
   *  expected to be active at a time; if more than one exists, the
   *  first by list order (oldest first) is used — same "first by
   *  creation order wins" resolution as keyword rules. */
  isFallback: boolean;
  active: boolean;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutoReplyRuleInput {
  keywords: string[];
  replyText: string;
  isFallback?: boolean;
  active?: boolean;
  organizationId?: string;
}

export interface UpdateAutoReplyRuleInput {
  keywords?: string[];
  replyText?: string;
  isFallback?: boolean;
  active?: boolean;
}

export interface AutoReplyRuleRepository {
  create(input: CreateAutoReplyRuleInput): Promise<AutoReplyRule>;
  findById(id: string): Promise<AutoReplyRule | null>;
  /** Oldest first — the deterministic match order every consumer relies on. */
  list(): Promise<AutoReplyRule[]>;
  /** Same ordering, pre-filtered to active:true — the matcher's own query. */
  listActive(): Promise<AutoReplyRule[]>;
  update(id: string, patch: UpdateAutoReplyRuleInput): Promise<AutoReplyRule>;
  delete(id: string): Promise<void>;
}
