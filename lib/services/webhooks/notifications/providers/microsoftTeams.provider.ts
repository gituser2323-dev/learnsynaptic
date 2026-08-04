import { OUTBOUND_WEBHOOK_TIMEOUT_MS } from "@/lib/net/timeouts";
import { NotificationProviderError } from "../../errors";
import type { NotificationMessage, NotificationProvider, NotificationSeverity } from "../types";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * Microsoft Teams' classic Incoming Webhook connector, real documented
 * "MessageCard" payload shape (`@type: "MessageCard"`,
 * `@context: "http://schema.org/extensions"`). Microsoft has been
 * steering new integrations toward Workflows/Adaptive Cards, but the
 * "register one webhook URL on a channel, POST a MessageCard" primitive
 * this module needs is still the real, stable, documented mechanism
 * for the simple one-way notification this feature calls for.
 */

const SEVERITY_COLOR: Record<NotificationSeverity, string> = {
  info: "3AA3E3",
  success: "2EB67D",
  warning: "ECB22E",
  error: "E01E5A",
};

export const microsoftTeamsProvider: NotificationProvider = {
  id: "microsoft_teams",

  async send(webhookUrl: string, message: NotificationMessage): Promise<void> {
    const facts = (message.attachments ?? []).map((a) => ({ name: a.label, value: a.value }));
    const mentionsText = (message.mentions ?? []).join(" ");

    const body = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor: SEVERITY_COLOR[message.severity],
      summary: message.title,
      title: message.title,
      text: [message.body, mentionsText].filter(Boolean).join("\n"),
      sections: facts.length > 0 ? [{ facts }] : undefined,
      potentialAction: (message.links ?? []).map((l) => ({
        "@type": "OpenUri",
        name: l.label,
        targets: [{ os: "default", uri: l.url }],
      })),
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(OUTBOUND_WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new NotificationProviderError("microsoft_teams", `send failed (${response.status}): ${text.slice(0, 200)}`);
    }
  },
};
