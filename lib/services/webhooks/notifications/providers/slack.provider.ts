import { OUTBOUND_WEBHOOK_TIMEOUT_MS } from "@/lib/net/timeouts";
import { NotificationProviderError } from "../../errors";
import type { NotificationMessage, NotificationProvider, NotificationSeverity } from "../types";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * Slack's real, documented "attachments" Incoming Webhook payload
 * shape (still fully functional despite Slack's own newer Block Kit
 * being the recommended format for net-new interactive apps — for a
 * one-way "post a rich message" webhook, `attachments` is the
 * simpler, stable, well-documented choice, the same "don't reach for
 * more complexity than the real requirement needs" judgment this
 * codebase already applies elsewhere).
 */

const SEVERITY_COLOR: Record<NotificationSeverity, string> = {
  info: "#3AA3E3",
  success: "#2EB67D",
  warning: "#ECB22E",
  error: "#E01E5A",
};

export const slackProvider: NotificationProvider = {
  id: "slack",

  async send(webhookUrl: string, message: NotificationMessage): Promise<void> {
    const fields = (message.attachments ?? []).map((a) => ({ title: a.label, value: a.value, short: true }));
    const linksText = (message.links ?? []).map((l) => `<${l.url}|${l.label}>`).join(" · ");
    const mentionsText = (message.mentions ?? []).join(" ");

    const body = {
      text: message.title,
      attachments: [
        {
          color: SEVERITY_COLOR[message.severity],
          title: message.title,
          text: [message.body, mentionsText, linksText].filter(Boolean).join("\n"),
          fields,
          footer: "LearnSynaptic",
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(OUTBOUND_WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new NotificationProviderError("slack", `send failed (${response.status}): ${text.slice(0, 200)}`);
    }
  },
};
