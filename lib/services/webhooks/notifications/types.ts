/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 * "Team Notifications" half. Slack/Microsoft Teams/Discord's real,
 * documented mechanism for "post a rich message into one known
 * channel" is a bare Incoming Webhook URL (see the pre-build research
 * and IntegrationCredentialRef's own "webhook_url" doc comment) — one
 * `NotificationProvider.send()` call per adapter, no OAuth flow.
 */

export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface NotificationLink {
  label: string;
  url: string;
}

/** `attachments` here means simple label/value fields shown inline in
 *  the rich message (what Slack/Teams/Discord's own message formats
 *  actually support without a real file) — not a real file attachment,
 *  which would need a publicly reachable URL (Module 6.2's own
 *  provider-dependent limitation) this module doesn't assume exists.
 *  `mentions` is plain text only (e.g. "@here", "@channel", or a
 *  literal name) — real per-user @mention resolution needs a
 *  provider's own user/member id, which this integration (a bare
 *  webhook URL, not a bot with directory access) has no way to look
 *  up; disclosed here rather than faking a mention that won't
 *  actually notify anyone. */
export interface NotificationMessage {
  title: string;
  body: string;
  severity: NotificationSeverity;
  links?: NotificationLink[];
  attachments?: { label: string; value: string }[];
  mentions?: string[];
}

export type NotificationProviderId = "slack" | "microsoft_teams" | "discord";

export interface NotificationProvider {
  readonly id: NotificationProviderId;
  send(webhookUrl: string, message: NotificationMessage): Promise<void>;
}
