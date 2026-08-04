import { SITE_URL } from "@/config/site";
import type { DomainEvent } from "@/lib/events";
import type { NotificationMessage, NotificationSeverity } from "./types";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — turns
 * ANY published DomainEvent into a NotificationMessage generically,
 * not via a hardcoded switch per event type. This is the concrete
 * mechanism behind the mission's own "future modules should be able
 * to publish new events without modifying core architecture": a brand
 * new event type a future module publishes (say, "invoice.overdue")
 * gets a sensible title/body/severity here with zero changes to this
 * file, the same way lib/events/eventBus.ts's own publish() never
 * needed a closed union of valid event types.
 */

function humanizeEventType(eventType: string): string {
  // "opportunity.stage_changed" -> "Opportunity Stage Changed"
  return eventType
    .split(".")
    .join(" ")
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferSeverity(eventType: string): NotificationSeverity {
  if (eventType.endsWith(".failed") || eventType.endsWith(".lost") || eventType.includes(".signature_invalid")) return "error";
  if (eventType.endsWith(".overdue")) return "warning";
  if (eventType.endsWith(".won") || eventType.endsWith(".completed") || eventType.endsWith(".converted")) return "success";
  return "info";
}

/** Field names common enough across this app's own event payloads
 *  that surfacing them generically (rather than per-event-type) covers
 *  most real cases — a genuinely unrecognized payload shape still
 *  renders correctly, just with fewer attachment fields. */
const SUMMARY_FIELD_CANDIDATES = ["name", "title", "email", "program", "source", "stageName", "assigneeId", "workflowId"];

function buildAttachments(payload: unknown): { label: string; value: string }[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const attachments: { label: string; value: string }[] = [];
  for (const key of SUMMARY_FIELD_CANDIDATES) {
    const value = record[key];
    if (value !== undefined && value !== null && (typeof value === "string" || typeof value === "number")) {
      attachments.push({ label: humanizeEventType(key), value: String(value) });
    }
  }
  return attachments;
}

function buildLinks(payload: unknown): { label: string; url: string }[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const links: { label: string; url: string }[] = [];
  if (typeof record.leadId === "string") links.push({ label: "View Lead", url: `${SITE_URL}/admin/leads/${record.leadId}` });
  return links;
}

export function formatEventAsNotification(event: DomainEvent): NotificationMessage {
  return {
    title: humanizeEventType(event.type),
    body: `Event "${event.type}" occurred at ${event.occurredAt}.`,
    severity: inferSeverity(event.type),
    attachments: buildAttachments(event.payload),
    links: buildLinks(event.payload),
  };
}
