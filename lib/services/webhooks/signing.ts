import { createHmac, timingSafeEqual } from "crypto";

/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — real
 * HMAC-SHA256 signing for OUTBOUND webhook deliveries, the standard
 * "sign `${timestamp}.${rawBody}`, deliver the signature and the
 * timestamp as headers" scheme (the same shape GitHub/Stripe's own
 * outbound webhooks use) — a receiving endpoint verifies the signature
 * over the exact bytes received, and can reject a request whose
 * timestamp is too old as real, receiver-side replay protection. This
 * app cannot enforce replay protection on someone else's server; what
 * it *can* do — and does — is deliver everything a receiver needs to
 * implement it themselves, undisclosed as anything more than that.
 *
 * `verifySignature()` exists for this app's own "Test Endpoint"/self-
 * check use and for unit tests — a receiving third party of course
 * implements their own verification independently using the same
 * documented scheme.
 */

export interface SignedWebhookHeaders {
  "X-LearnSynaptic-Signature": string;
  "X-LearnSynaptic-Timestamp": string;
  "X-LearnSynaptic-Event": string;
}

function computeSignature(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function signWebhookPayload(secret: string, eventType: string, rawBody: string): SignedWebhookHeaders {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = computeSignature(secret, timestamp, rawBody);
  return {
    "X-LearnSynaptic-Signature": `sha256=${signature}`,
    "X-LearnSynaptic-Timestamp": timestamp,
    "X-LearnSynaptic-Event": eventType,
  };
}

export function verifySignature(secret: string, timestamp: string, rawBody: string, signatureHeader: string): boolean {
  const expected = computeSignature(secret, timestamp, rawBody);
  const provided = signatureHeader.replace(/^sha256=/, "");
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(provided, "hex");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
