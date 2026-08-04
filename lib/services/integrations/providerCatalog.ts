import type { IntegrationProviderDescriptor } from "./types";

/**
 * The static Provider Registry — "adding a future provider should
 * require minimal core changes." A new provider is a new entry here
 * (plus, when it's actually implemented, a real adapter in its own
 * module) — never a new branch inside integrationService.ts, never a
 * new switch statement anywhere in the CRM. This file is the ONLY
 * place that lists every provider LearnSynaptic knows about.
 */
export const INTEGRATION_PROVIDERS: IntegrationProviderDescriptor[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    category: "communication",
    capabilities: ["send_message", "receive_message"],
    builtIn: true,
    description: "WhatsApp Business messaging — campaigns, conversations, and automated replies (Phase 2).",
  },
  {
    id: "email",
    name: "Email",
    category: "communication",
    capabilities: ["send_message", "receive_message"],
    builtIn: true,
    description: "Email as a second Conversation channel alongside WhatsApp (Phase 4).",
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "ai",
    capabilities: ["generate_text"],
    builtIn: true,
    description: "AI Lead Insights, Reply Assistant, and Conversational Analytics (Phase 5).",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "ai",
    capabilities: ["generate_text"],
    builtIn: true,
    description: "AI Lead Insights, Reply Assistant, and Conversational Analytics (Phase 5).",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "ai",
    capabilities: ["generate_text"],
    builtIn: true,
    description: "AI Lead Insights, Reply Assistant, and Conversational Analytics (Phase 5).",
  },
  {
    id: "aws_s3",
    name: "AWS S3",
    category: "storage",
    capabilities: ["store_file"],
    builtIn: false,
    description: "Managed file storage for media uploads and attachments — real upload/download/delete/signed-URL support (Module 6.2). Connect and enable here to activate it.",
  },
  {
    id: "cloudinary",
    name: "Cloudinary",
    category: "storage",
    capabilities: ["store_file"],
    builtIn: false,
    description: "Managed media storage and transformation — real upload/download/delete support (Module 6.2). Private/signed delivery is not yet implemented for this vendor; prefer AWS S3 for private files.",
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    category: "calendar",
    capabilities: ["schedule_meeting"],
    builtIn: false,
    description: "Scheduling counsellor calls and follow-ups — real OAuth connect, event CRUD, availability lookup, and calendar selection (Module 6.3).",
  },
  {
    id: "google_meet",
    name: "Google Meet",
    category: "calendar",
    capabilities: ["schedule_meeting"],
    builtIn: false,
    description: "Video meeting links for scheduled calls — shares Google Calendar's own OAuth connection and event API; every event this provider creates includes a real Meet link (Module 6.3).",
  },
  {
    id: "microsoft_outlook_calendar",
    name: "Microsoft Outlook Calendar",
    category: "calendar",
    capabilities: ["schedule_meeting"],
    builtIn: false,
    description: "Scheduling counsellor calls and follow-ups via Microsoft Graph — real OAuth connect, event CRUD, availability lookup, and calendar selection (Module 6.3).",
  },
  {
    id: "microsoft_teams_meetings",
    name: "Microsoft Teams (Meetings)",
    category: "calendar",
    capabilities: ["schedule_meeting"],
    builtIn: false,
    description: "Video meeting links for scheduled calls via Microsoft Graph online meetings — shares Outlook Calendar's own OAuth connection (Module 6.3). Distinct from the \"Microsoft Teams\" notifications provider below, which is a Module 6.5 team-notification webhook, not a meeting connector.",
  },
  {
    id: "zoom",
    name: "Zoom",
    category: "calendar",
    capabilities: ["schedule_meeting"],
    builtIn: false,
    description: "Video meeting links for scheduled calls — real OAuth connect and meeting creation via Zoom's own REST API (Module 6.3).",
  },
  {
    id: "razorpay",
    name: "Razorpay",
    category: "payments",
    capabilities: ["process_payment"],
    builtIn: false,
    description: "Real payment collection for program fees (India) — hosted Payment Links checkout, webhook-verified status, and refunds via Razorpay's own API (Module 6.4).",
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    capabilities: ["process_payment"],
    builtIn: false,
    description: "Real payment collection for program fees (international) — hosted Checkout Sessions, webhook-verified status, and refunds via Stripe's own API (Module 6.4).",
  },
  {
    id: "cashfree",
    name: "Cashfree",
    category: "payments",
    capabilities: ["process_payment"],
    builtIn: false,
    description: "Real payment collection for program fees (India) — a second real gateway alongside Razorpay, hosted Payment Links checkout and webhook-verified status via Cashfree's own API (Module 6.4).",
  },
  {
    id: "phonepe",
    name: "PhonePe",
    category: "payments",
    capabilities: ["process_payment"],
    builtIn: false,
    plannedModule: "future — Payments provider",
    description: "Named as a future payment provider in Module 6.4's own mission. Registered in the Payment Provider Registry so a later pass only needs a real adapter, not a redesign — connecting here today throws a disclosed \"not yet implemented\" error rather than silently accepting real money.",
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "payments",
    capabilities: ["process_payment"],
    builtIn: false,
    plannedModule: "future — Payments provider",
    description: "Named as a future payment provider in Module 6.4's own mission. Same disclosed-scaffold posture as PhonePe above.",
  },
  {
    id: "slack",
    name: "Slack",
    category: "notifications",
    capabilities: ["send_notification"],
    builtIn: false,
    description: "Real team notifications via a Slack Incoming Webhook — new leads, overdue tasks, opportunity wins/losses, workflow failures, and any other subscribed event (Module 6.5). Connect here with the channel's own webhook URL.",
  },
  {
    id: "microsoft_teams",
    name: "Microsoft Teams",
    category: "notifications",
    capabilities: ["send_notification"],
    builtIn: false,
    description: "Real team notifications via a Microsoft Teams Incoming Webhook connector (Module 6.5). Connect here with the channel's own webhook URL. Distinct from \"Microsoft Teams (Meetings)\" above, which is Module 6.3's video-meeting connector, not a notification channel.",
  },
  {
    id: "discord",
    name: "Discord",
    category: "notifications",
    capabilities: ["send_notification"],
    builtIn: false,
    description: "Real team notifications via a Discord Incoming Webhook (Module 6.5). Connect here with the channel's own webhook URL.",
  },
  {
    id: "generic_webhook",
    name: "Generic Webhook",
    category: "other",
    capabilities: ["receive_webhook", "send_notification"],
    builtIn: false,
    description: "Real outbound event delivery to any HTTP endpoint (Module 6.5) — HMAC-signed, retried, with delivery history. Managed through its own dedicated Webhook Endpoints panel below, not through Connect here (an org can register many independent endpoints, not just one connection).",
  },
];

export function getProviderDescriptor(providerId: string): IntegrationProviderDescriptor | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.id === providerId);
}
