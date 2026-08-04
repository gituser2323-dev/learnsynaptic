import { WHATSAPP_ACTIVE_PROVIDER } from "@/config/whatsapp";
import { EMAIL_ACTIVE_PROVIDER } from "@/config/emailChannel";
import { AI_ACTIVE_PROVIDER, OPENAI_CONFIG, ANTHROPIC_CONFIG, GEMINI_CONFIG } from "@/config/aiInsights";
import type { IntegrationConnectionStatus, IntegrationHealthStatus } from "./types";

/**
 * Read-only introspection of the three integrations that already have
 * real, working provider-registry seams (WhatsApp/Phase 2, Email/Phase
 * 4, AI/Phase 5) — this is how their live connection state reaches the
 * registry's merged view without a second, competing source of truth.
 * Never writes anything; never re-implements vendor selection, which
 * stays exactly where it already lives (lib/services/whatsapp/registry.ts,
 * lib/services/email/registry.ts, lib/services/ai/registry.ts).
 *
 * No sync timestamps are reported for these three — "last successful/
 * failed sync" would have to be fabricated for a provider whose real
 * activity (a WhatsApp send, an AI call) isn't tracked as a "sync"
 * anywhere; only `status`/`enabled`/`health`, all honestly derivable
 * from existing config right now, are reported.
 */
export interface BuiltInStatus {
  status: IntegrationConnectionStatus;
  enabled: boolean;
  health: IntegrationHealthStatus;
}

function whatsappStatus(): BuiltInStatus {
  const connected = WHATSAPP_ACTIVE_PROVIDER !== "console";
  return { status: connected ? "connected" : "disconnected", enabled: connected, health: connected ? "ok" : "unknown" };
}

function emailStatus(): BuiltInStatus {
  const connected = EMAIL_ACTIVE_PROVIDER !== "console";
  return { status: connected ? "connected" : "disconnected", enabled: connected, health: connected ? "ok" : "unknown" };
}

/** Each AI vendor is independently "connected" if its own API key is
 *  set (regardless of which one AI_PROVIDER currently selects) — but
 *  only the active one is "enabled", since exactly one vendor can be
 *  active at a time. Mirrors how lib/services/ai/registry.ts's own
 *  isAiProviderConfigured() reasons about a single active choice. */
function aiVendorStatus(vendorId: "openai" | "anthropic" | "gemini"): BuiltInStatus {
  const apiKey = { openai: OPENAI_CONFIG.apiKey, anthropic: ANTHROPIC_CONFIG.apiKey, gemini: GEMINI_CONFIG.apiKey }[vendorId];
  const connected = apiKey.length > 0;
  const enabled = connected && AI_ACTIVE_PROVIDER === vendorId;
  return { status: connected ? "connected" : "disconnected", enabled, health: connected ? "ok" : "unknown" };
}

export function getBuiltInStatus(providerId: string): BuiltInStatus | undefined {
  switch (providerId) {
    case "whatsapp":
      return whatsappStatus();
    case "email":
      return emailStatus();
    case "openai":
    case "anthropic":
    case "gemini":
      return aiVendorStatus(providerId);
    default:
      return undefined;
  }
}
