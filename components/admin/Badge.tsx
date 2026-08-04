export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_STYLES: Record<BadgeTone, { bg: string; color: string; border: string }> = {
  neutral: { bg: "var(--adm-surface-2)", color: "var(--adm-text-secondary)", border: "var(--adm-border-strong)" },
  info: { bg: "var(--adm-info-soft)", color: "var(--adm-info)", border: "transparent" },
  success: { bg: "var(--adm-success-soft)", color: "var(--adm-success)", border: "transparent" },
  warning: { bg: "var(--adm-warning-soft)", color: "var(--adm-warning)", border: "transparent" },
  danger: { bg: "var(--adm-danger-soft)", color: "var(--adm-danger)", border: "transparent" },
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  const style = TONE_STYLES[tone];
  return (
    <span className="adm-chip" style={{ background: style.bg, color: style.color, borderColor: style.border }}>
      <span className="adm-chip-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Kept next to the tones themselves (rather than scattered per-page)
 *  so the status→color mapping can't drift out of sync across the
 *  Leads/Campaigns/Registrations pages that each use it. */
export function leadStatusTone(status: string): BadgeTone {
  switch (status) {
    case "registered":
      return "success";
    case "closed":
      return "neutral";
    case "nurture":
      return "warning";
    case "contacted":
      return "info";
    default:
      return "neutral";
  }
}

export function campaignStatusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
      return "success";
    case "paused":
      return "warning";
    case "ended":
      return "neutral";
    default:
      return "info";
  }
}

export function registrationStatusTone(status: string): BadgeTone {
  switch (status) {
    case "confirmed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "info";
  }
}

export function whatsappCampaignStatusTone(status: string): BadgeTone {
  switch (status) {
    case "completed":
      return "success";
    case "sending":
    case "scheduled":
      return "info";
    case "ready":
    case "draft":
      return "neutral";
    case "failed":
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function messageStatusTone(status: string): BadgeTone {
  switch (status) {
    case "delivered":
    case "read":
      return "success";
    case "sent":
    case "sending":
      return "info";
    case "queued":
      return "neutral";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

export function auditCategoryTone(category: string): BadgeTone {
  return category === "security" ? "warning" : "info";
}

export function workflowRunStatusTone(status: string): BadgeTone {
  switch (status) {
    case "completed":
      return "success";
    case "pending":
    case "waiting":
      return "info";
    case "failed":
      return "danger";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Enterprise CRM (Phase 1) — Lead Scoring's health badge. */
export function leadHealthTone(health: string): BadgeTone {
  switch (health) {
    case "hot":
      return "danger";
    case "warm":
      return "warning";
    case "cold":
      return "info";
    default:
      return "neutral";
  }
}

export function buyingIntentTone(intent: string): BadgeTone {
  switch (intent) {
    case "high":
      return "success";
    case "medium":
      return "warning";
    case "low":
      return "danger";
    default:
      return "neutral";
  }
}

export function conversationSentimentTone(sentiment: string): BadgeTone {
  switch (sentiment) {
    case "positive":
      return "success";
    case "negative":
      return "danger";
    case "mixed":
      return "warning";
    default:
      return "neutral";
  }
}

export function conversationIntentTone(intent: string): BadgeTone {
  switch (intent) {
    case "ready_to_enroll":
      return "success";
    case "objection":
      return "danger";
    case "price_negotiation":
    case "unresponsive":
      return "warning";
    default:
      return "info";
  }
}

export function integrationStatusTone(status: string): BadgeTone {
  return status === "connected" ? "success" : "neutral";
}

export function integrationHealthTone(health: string): BadgeTone {
  switch (health) {
    case "ok":
      return "success";
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

export function taskPriorityTone(priority: string): BadgeTone {
  switch (priority) {
    case "high":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "info";
    default:
      return "neutral";
  }
}

export function opportunityStatusTone(status: string): BadgeTone {
  switch (status) {
    case "won":
      return "success";
    case "lost":
      return "danger";
    default:
      return "info";
  }
}

/** WhatsApp Platform (Phase 2) — Conversations inbox. */
export function conversationStatusTone(status: string): BadgeTone {
  return status === "open" ? "info" : "neutral";
}

/** WhatsApp Platform (Phase 2), Module 2.4 — Webhook Deliveries panel.
 *  "signature_invalid" is deliberately its own danger tone, distinct
 *  from "unrecognized" — the module's own Definition of Done requires
 *  a forged/misconfigured request to read differently from a
 *  successful delivery that just had nothing actionable in it. */
/** WhatsApp Platform (Phase 2), Module 2.3 — Business Account Health.
 *  Mirrors Meta's own quality-rating semantics (green/yellow/red)
 *  rather than inventing a fresh tone mapping. */
export function qualityRatingTone(rating: string): BadgeTone {
  switch (rating) {
    case "green":
      return "success";
    case "yellow":
      return "warning";
    case "red":
      return "danger";
    default:
      return "neutral";
  }
}

export function webhookDeliveryOutcomeTone(outcome: string): BadgeTone {
  switch (outcome) {
    case "processed":
      return "success";
    case "signature_invalid":
      return "danger";
    default:
      return "neutral";
  }
}

/** Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 *  outbound endpoint status. Distinct tone map from the inbound
 *  webhookDeliveryOutcomeTone above: "auto_disabled" gets its own
 *  warning tone, separate from a manual "disabled", since it signals
 *  a real failing endpoint that needs attention rather than an
 *  intentional pause. */
export function webhookEndpointStatusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
      return "success";
    case "auto_disabled":
      return "warning";
    default:
      return "neutral";
  }
}

/** Payments Integration (Phase 6), Module 6.4. "partially_refunded"
 *  gets the same warning tone as "failed" deliberately — both mean
 *  "this transaction needs a human to look at it," distinct from a
 *  clean terminal "refunded"/"succeeded". */
export function paymentStatusTone(status: string): BadgeTone {
  switch (status) {
    case "succeeded":
      return "success";
    case "created":
    case "pending":
      return "info";
    case "failed":
      return "danger";
    case "refunded":
      return "neutral";
    case "partially_refunded":
      return "warning";
    default:
      return "neutral";
  }
}

export function paymentWebhookOutcomeTone(outcome: string): BadgeTone {
  switch (outcome) {
    case "processed":
      return "success";
    case "processing":
      return "info";
    case "duplicate":
      return "neutral";
    case "signature_invalid":
      return "danger";
    case "error":
      return "warning";
    default:
      return "neutral";
  }
}

export function outboundWebhookDeliveryOutcomeTone(outcome: string): BadgeTone {
  switch (outcome) {
    case "delivered":
      return "success";
    case "pending":
      return "info";
    case "failed":
      return "warning";
    case "dead_letter":
      return "danger";
    default:
      return "neutral";
  }
}

/** RC-3 — Reliability panel's ScheduledJob status. "dead_lettered" gets
 *  its own danger tone distinct from "failed"'s warning: a dead-lettered
 *  job is retry-eligible and actionable right now (see
 *  lib/services/scheduler/types.ts's own doc comment on the
 *  distinction), the more urgent of the two for an admin scanning this
 *  table. */
export function scheduledJobStatusTone(status: string): BadgeTone {
  switch (status) {
    case "completed":
      return "success";
    case "pending":
    case "processing":
      return "info";
    case "failed":
      return "warning";
    case "dead_lettered":
      return "danger";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}
