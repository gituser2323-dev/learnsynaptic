import { META_CLOUD_API_CONFIG, META_EMBEDDED_SIGNUP_CONFIG } from "@/config/whatsapp";
import { createLogger } from "@/lib/logger";
import { MESSAGING_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { EmbeddedSignupError } from "./types";

const logger = createLogger({ service: "whatsapp", module: "embeddedSignup.graph" });

/**
 * Every real Meta Graph API call this module needs beyond messaging
 * (already covered by providers/metaCloudApi.provider.ts) — the
 * server-side half of Embedded Signup: code exchange, WABA/phone
 * discovery, and webhook subscription. Field names and endpoints below
 * are Meta's own long-documented Embedded Signup + WhatsApp Business
 * Management API shapes — verify against Meta's current docs before
 * relying on this in production, the same caveat metaCloudApi.provider.ts's
 * own top-of-file comment already carries for every vendor adapter in
 * this app.
 */

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${META_EMBEDDED_SIGNUP_CONFIG.graphApiVersion}/${path}`;
}

interface TokenExchangeResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string; type?: string; code?: number };
}

/**
 * Exchanges the short-lived authorization `code` the Embedded Signup
 * popup returned for a real Meta access token — the one server-side
 * secret call in this whole flow that needs the platform App Secret,
 * which a browser never sees. Meta's own documented Embedded Signup
 * token-exchange endpoint (distinct from a normal 3-legged OAuth
 * `redirect_uri`-based exchange — Embedded Signup deliberately has no
 * redirect_uri at all, since the whole flow runs inside a popup that
 * never navigates away from this app).
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const url = new URL(graphUrl("oauth/access_token"));
  url.searchParams.set("client_id", META_EMBEDDED_SIGNUP_CONFIG.appId);
  url.searchParams.set("client_secret", META_CLOUD_API_CONFIG.appSecret);
  url.searchParams.set("code", code);

  let response: Response;
  try {
    response = await fetch(url.toString(), { method: "GET", signal: AbortSignal.timeout(MESSAGING_PROVIDER_TIMEOUT_MS) });
  } catch (error) {
    logger.error("whatsapp.embedded_signup.exchange_network_error", { error: error instanceof Error ? error.message : String(error) });
    throw new EmbeddedSignupError("meta_unavailable", "Could not reach Meta to complete the connection. Try again shortly.");
  }

  const json = (await response.json().catch(() => null)) as TokenExchangeResponse | null;
  if (!response.ok || !json?.access_token) {
    logger.warn("whatsapp.embedded_signup.exchange_failed", { status: response.status, error: json?.error?.message });
    throw new EmbeddedSignupError("exchange_failed", json?.error?.message ?? "Meta rejected the authorization code.");
  }
  return json.access_token;
}

interface WabaPhoneNumbersResponse {
  data?: { id?: string; display_phone_number?: string; verified_name?: string; code_verification_status?: string; quality_rating?: string }[];
  error?: { message?: string };
}

export interface DiscoveredPhoneNumber {
  phoneNumberId: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  verificationStatus: "verified" | "not_verified" | "unknown";
  qualityRating: "green" | "yellow" | "red" | "unknown";
}

/** Meta's WhatsApp Business Management API — every real phone number
 *  belonging to a WABA, scoped by the access token's own granted
 *  permissions (never a caller-supplied filter — this is the real
 *  ownership boundary Meta itself enforces, which is exactly why this
 *  module re-derives the phone list from Meta rather than trusting
 *  whatever the client-side popup claimed). */
export async function listWabaPhoneNumbers(wabaId: string, accessToken: string): Promise<DiscoveredPhoneNumber[]> {
  let response: Response;
  try {
    response = await fetch(
      graphUrl(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating`),
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(MESSAGING_PROVIDER_TIMEOUT_MS) },
    );
  } catch (error) {
    logger.error("whatsapp.embedded_signup.discovery_network_error", { error: error instanceof Error ? error.message : String(error) });
    throw new EmbeddedSignupError("meta_unavailable", "Could not reach Meta to discover phone numbers. Try again shortly.");
  }

  const json = (await response.json().catch(() => null)) as WabaPhoneNumbersResponse | null;
  if (!response.ok || !json?.data) {
    logger.warn("whatsapp.embedded_signup.discovery_failed", { status: response.status, error: json?.error?.message });
    throw new EmbeddedSignupError("discovery_failed", json?.error?.message ?? "Could not discover phone numbers for this WhatsApp Business Account.");
  }

  return json.data
    .filter((entry): entry is Required<Pick<typeof entry, "id">> & typeof entry => typeof entry.id === "string")
    .map((entry) => ({
      phoneNumberId: entry.id,
      displayPhoneNumber: entry.display_phone_number,
      verifiedName: entry.verified_name,
      verificationStatus: normalizeVerificationStatus(entry.code_verification_status),
      qualityRating: normalizeQualityRating(entry.quality_rating),
    }));
}

interface SubscribeAppResponse {
  success?: boolean;
  error?: { message?: string };
}

/** Meta's own documented step to make a WABA's message/status webhooks
 *  actually flow to this app's ONE registered webhook URL (configured
 *  once, platform-wide, in the Meta App Dashboard) — without this call,
 *  a fully "connected" WABA would silently never deliver any inbound
 *  traffic. Idempotent on Meta's own side: subscribing an already-
 *  subscribed app is a harmless no-op success. */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(graphUrl(`${wabaId}/subscribed_apps`), {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(MESSAGING_PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    logger.error("whatsapp.embedded_signup.webhook_subscribe_network_error", { error: error instanceof Error ? error.message : String(error) });
    throw new EmbeddedSignupError("meta_unavailable", "Could not reach Meta to configure webhooks. Try again shortly.");
  }

  const json = (await response.json().catch(() => null)) as SubscribeAppResponse | null;
  if (!response.ok || json?.success !== true) {
    logger.warn("whatsapp.embedded_signup.webhook_subscribe_failed", { wabaId, status: response.status, error: json?.error?.message });
    throw new EmbeddedSignupError("discovery_failed", json?.error?.message ?? "Could not subscribe this app to the WhatsApp Business Account's webhooks.");
  }
}

/** Best-effort — called from disconnect(), never allowed to block it.
 *  Meta's own documented unsubscribe call; a stale/already-revoked
 *  token failing here is expected and fine (the connection is being
 *  torn down anyway). */
export async function unsubscribeAppFromWaba(wabaId: string, accessToken: string): Promise<void> {
  try {
    await fetch(graphUrl(`${wabaId}/subscribed_apps`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(MESSAGING_PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn("whatsapp.embedded_signup.webhook_unsubscribe_failed", { wabaId, error: error instanceof Error ? error.message : String(error) });
  }
}

export function normalizeVerificationStatus(raw: string | undefined): "verified" | "not_verified" | "unknown" {
  const value = (raw ?? "").toUpperCase();
  if (value === "VERIFIED") return "verified";
  if (value === "NOT_VERIFIED" || value === "EXPIRED" || value === "PENDING") return "not_verified";
  return "unknown";
}

export function normalizeQualityRating(raw: string | undefined): "green" | "yellow" | "red" | "unknown" {
  const value = (raw ?? "").toUpperCase();
  if (value === "GREEN" || value === "YELLOW" || value === "RED") return value.toLowerCase() as "green" | "yellow" | "red";
  return "unknown";
}
