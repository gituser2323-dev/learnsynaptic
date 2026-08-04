import { OUTBOUND_WEBHOOK_TIMEOUT_MS } from "@/lib/net/timeouts";
import { NotificationProviderError } from "../../errors";
import type { NotificationMessage, NotificationProvider, NotificationSeverity } from "../types";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * Discord's real, documented Incoming Webhook "embed" payload shape.
 * Discord always uses a bare webhook URL for "post into one channel"
 * (there is no simpler OAuth-token path for this use case — a full
 * bot token + gateway connection is a materially heavier lift, only
 * needed for slash commands/interactivity this feature doesn't need).
 * `color` is a decimal integer per Discord's own API, not a hex
 * string — the one real format difference from Slack/Teams above.
 */

const SEVERITY_COLOR: Record<NotificationSeverity, number> = {
  info: 0x3aa3e3,
  success: 0x2eb67d,
  warning: 0xecb22e,
  error: 0xe01e5a,
};

export const discordProvider: NotificationProvider = {
  id: "discord",

  async send(webhookUrl: string, message: NotificationMessage): Promise<void> {
    const fields = (message.attachments ?? []).map((a) => ({ name: a.label, value: a.value, inline: true }));
    const linksText = (message.links ?? []).map((l) => `[${l.label}](${l.url})`).join(" · ");
    const mentionsText = (message.mentions ?? []).join(" ");

    const body = {
      content: mentionsText || undefined,
      embeds: [
        {
          title: message.title,
          description: [message.body, linksText].filter(Boolean).join("\n"),
          color: SEVERITY_COLOR[message.severity],
          fields,
          footer: { text: "LearnSynaptic" },
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
      throw new NotificationProviderError("discord", `send failed (${response.status}): ${text.slice(0, 200)}`);
    }
  },
};
