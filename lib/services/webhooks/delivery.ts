import { OUTBOUND_WEBHOOK_TIMEOUT_MS } from "@/lib/net/timeouts";
import { decryptSecret } from "./secretCrypto";
import { signWebhookPayload } from "./signing";
import { truncateResponseSnippet } from "./validation";
import type { WebhookEndpoint } from "./types";

const DELIVERY_TIMEOUT_MS = OUTBOUND_WEBHOOK_TIMEOUT_MS;

export interface DeliveryResult {
  success: boolean;
  httpStatusCode?: number;
  responseSnippet?: string;
  error?: string;
  /** Whether this specific failure is worth retrying — 5xx/429/network/
   *  timeout are transient (retryable); any other 4xx means the
   *  receiving endpoint has definitively rejected this request shape,
   *  and retrying identical bytes won't change that. */
  retryable: boolean;
}

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 * one real HTTP delivery call, shared by the scheduled retry job
 * handler, "Test Endpoint," and "Replay Failed Events" (jobHandlers.ts/
 * webhookService.ts) so all three sign and send identically — no
 * second, subtly-different delivery path for the "test" case.
 */
export async function deliverWebhookPayload(
  endpoint: WebhookEndpoint,
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<DeliveryResult> {
  const secret = decryptSecret(endpoint.encryptedSecret);
  const rawBody = JSON.stringify({ id: eventId, type: eventType, payload, occurredAt: new Date().toISOString() });
  const signedHeaders = signWebhookPayload(secret, eventType, rawBody);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: { ...signedHeaders, "Content-Type": "application/json" },
      body: rawBody,
      signal: controller.signal,
    });
    const text = await response.text().catch(() => "");
    const responseSnippet = truncateResponseSnippet(text);

    if (response.ok) {
      return { success: true, httpStatusCode: response.status, responseSnippet, retryable: false };
    }
    const retryable = response.status >= 500 || response.status === 429;
    return {
      success: false,
      httpStatusCode: response.status,
      responseSnippet,
      error: `HTTP ${response.status}`,
      retryable,
    };
  } catch (error) {
    // Network error, DNS failure, or the AbortController's own timeout —
    // all transient, all worth retrying.
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delivery failed (network error or timeout).",
      retryable: true,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
