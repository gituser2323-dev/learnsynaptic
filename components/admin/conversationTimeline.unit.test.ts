import { describe, it, expect } from "vitest";
import { buildUnifiedTimeline } from "./conversationTimeline";
import type { Message } from "@/lib/services/whatsappCampaigns";
import type { Activity } from "@/lib/services/crm/activities";

/**
 * Communication Center, Module 4.1 (Unified Inbox) — promoted from the
 * ad hoc verification script used while building the module (see
 * CHANGELOG.md's "Module 4.1" entry) into a committed test, per the
 * standing unit-test-layer debt item's own first entry (implementation
 * audit §6). Directly asserts the blueprint's own two stated
 * requirements for this module: correct WhatsApp + email + note
 * interleaving, and the Definition of Done's "renders identically to
 * before" clause for a WhatsApp-only conversation.
 */

function msg(id: string, createdAt: string, messageType: Message["messageType"] = "text"): Message {
  return {
    id,
    createdAt,
    direction: "inbound",
    body: `msg-${id}`,
    status: "delivered",
    messageType,
    attempts: 0,
  } as unknown as Message;
}

function activity(id: string, createdAt: string, type: Activity["type"]): Activity {
  return {
    id,
    entityType: "Conversation",
    entityId: "conv-1",
    type,
    body: `activity-${id}`,
    createdAt,
  } as unknown as Activity;
}

function keyOf(entry: ReturnType<typeof buildUnifiedTimeline>[number]): string {
  return entry.kind === "message" ? entry.message.id : entry.activity.id;
}

describe("buildUnifiedTimeline", () => {
  it("interleaves WhatsApp + email + note + system entries by timestamp — the blueprint's own Testing requirement", () => {
    const wa = msg("wa1", "2026-07-30T10:00:00.000Z", "text");
    const note = activity("n1", "2026-07-30T10:05:00.000Z", "note");
    const email = msg("em1", "2026-07-30T10:10:00.000Z", "email");
    const sys = activity("s1", "2026-07-30T10:15:00.000Z", "system");

    const timeline = buildUnifiedTimeline([email, wa], [sys, note]);
    expect(timeline.map(keyOf)).toEqual(["wa1", "n1", "em1", "s1"]);
  });

  it("a WhatsApp-only conversation with no notes/email renders identically to before this module — the Definition of Done's own clause", () => {
    const messages = [msg("wa1", "2026-07-30T09:00:00.000Z"), msg("wa2", "2026-07-30T09:05:00.000Z")];
    const timeline = buildUnifiedTimeline(messages, []);

    expect(timeline).toHaveLength(2);
    expect(timeline.every((entry) => entry.kind === "message")).toBe(true);
    expect(timeline.map(keyOf)).toEqual(["wa1", "wa2"]);
  });

  it("excludes every Activity type other than note/system — those belong to the Lead's own CRM timeline, not this Conversation-scoped one", () => {
    const wa = msg("wa1", "2026-07-30T10:00:00.000Z");
    const note = activity("n1", "2026-07-30T10:01:00.000Z", "note");
    const call = activity("c1", "2026-07-30T10:02:00.000Z", "call" as Activity["type"]);
    const meeting = activity("m1", "2026-07-30T10:03:00.000Z", "meeting" as Activity["type"]);

    const timeline = buildUnifiedTimeline([wa], [note, call, meeting]);
    expect(timeline.map(keyOf)).toEqual(["wa1", "n1"]);
  });

  it("an empty conversation (no messages, no activities) returns an empty timeline", () => {
    expect(buildUnifiedTimeline([], [])).toEqual([]);
  });

  it("entries with an identical timestamp keep a stable, deterministic order", () => {
    const wa = msg("wa1", "2026-07-30T10:00:00.000Z");
    const note = activity("n1", "2026-07-30T10:00:00.000Z", "note");
    // Messages are concatenated before activities in the merge input,
    // so a tie should resolve message-first via Array.sort's stability.
    expect(buildUnifiedTimeline([wa], [note]).map(keyOf)).toEqual(["wa1", "n1"]);
  });
});
