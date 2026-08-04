import { describe, it, expect } from "vitest";
import { formatEventAsNotification } from "./formatter";
import type { DomainEvent } from "@/lib/events";

function makeEvent(type: string, payload: unknown = {}): DomainEvent {
  return { id: "evt_1", type, version: "1", payload, occurredAt: "2026-06-01T10:00:00.000Z" };
}

describe("formatEventAsNotification — generic, works for ANY event type without a hardcoded switch", () => {
  it("humanizes the event type into a title", () => {
    const message = formatEventAsNotification(makeEvent("opportunity.stage_changed"));
    expect(message.title).toBe("Opportunity Stage Changed");
  });

  it("formats a genuinely unrecognized future event type sensibly, with zero special-casing", () => {
    const message = formatEventAsNotification(makeEvent("invoice.overdue_reminder", { name: "Acme Corp" }));
    expect(message.title).toBe("Invoice Overdue Reminder");
    expect(message.body).toContain("invoice.overdue_reminder");
    expect(message.attachments).toEqual([{ label: "Name", value: "Acme Corp" }]);
  });

  it.each([
    ["lead.created", "info"],
    ["message.received", "info"],
    ["opportunity.won", "success"],
    ["workflow.completed", "success"],
    ["lead.converted", "success"],
    ["opportunity.lost", "error"],
    ["whatsapp.message.failed", "error"],
    ["task.overdue", "warning"],
  ])("infers severity for %s as %s", (eventType, expectedSeverity) => {
    expect(formatEventAsNotification(makeEvent(eventType)).severity).toBe(expectedSeverity);
  });

  it("surfaces common payload fields as attachments generically", () => {
    const message = formatEventAsNotification(makeEvent("lead.created", { name: "Jane Doe", email: "jane@example.com", source: "facebook_ad" }));
    expect(message.attachments).toEqual(
      expect.arrayContaining([
        { label: "Name", value: "Jane Doe" },
        { label: "Email", value: "jane@example.com" },
        { label: "Source", value: "facebook_ad" },
      ]),
    );
  });

  it("builds a 'View Lead' link when the payload carries a leadId", () => {
    const message = formatEventAsNotification(makeEvent("task.created", { leadId: "lead_42" }));
    expect(message.links).toEqual([{ label: "View Lead", url: expect.stringContaining("/admin/leads/lead_42") }]);
  });

  it("produces no links when the payload has no leadId", () => {
    const message = formatEventAsNotification(makeEvent("workflow.started", { workflowId: "wf_1" }));
    expect(message.links).toEqual([]);
  });

  it("handles a non-object payload without throwing", () => {
    expect(() => formatEventAsNotification(makeEvent("custom.event", "not an object"))).not.toThrow();
    expect(() => formatEventAsNotification(makeEvent("custom.event", null))).not.toThrow();
  });
});
