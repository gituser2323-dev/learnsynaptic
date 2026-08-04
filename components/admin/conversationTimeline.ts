import type { Message } from "@/lib/services/whatsappCampaigns";
import type { Activity } from "@/lib/services/crm/activities";

/**
 * Communication Center (Phase 4), Module 4.1 — Unified Inbox. Merges a
 * conversation's Messages (WhatsApp + email, per Module 4.2) and its
 * internal-note/system-event Activity feed (module 2.1's own thread
 * view) into one chronologically-ordered timeline, replacing the two
 * separate panes the pre-4.1 thread view rendered them in. A pure
 * function, not a component, so the interleaving logic itself is
 * testable without a browser or a database — the blueprint's own
 * Testing requirement for this module is exactly this ordering.
 *
 * Deliberately excludes every other Activity type (call/meeting/
 * whatsapp_reference/etc.) — those belong to the Lead's own CRM
 * timeline (module 1.1), not this Conversation-scoped thread; only
 * "note" and "system" ever get logged against entityType:"Conversation"
 * in the first place (see conversationService.addInternalNote/
 * setStatus), so this filter is a safety net, not a behavior change.
 */
export type TimelineEntry =
  | { kind: "message"; timestamp: string; message: Message }
  | { kind: "activity"; timestamp: string; activity: Activity };

export function buildUnifiedTimeline(messages: Message[], activities: Activity[]): TimelineEntry[] {
  const threadActivities = activities.filter((activity) => activity.type === "note" || activity.type === "system");

  const entries: TimelineEntry[] = [
    ...messages.map((message): TimelineEntry => ({ kind: "message", timestamp: message.createdAt, message })),
    ...threadActivities.map((activity): TimelineEntry => ({ kind: "activity", timestamp: activity.createdAt, activity })),
  ];

  // Stable sort — Array.prototype.sort is guaranteed stable since
  // ES2019, so two entries with an identical timestamp keep their
  // original relative order (messages before activities), rather than
  // an implementation-dependent shuffle.
  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return entries;
}
