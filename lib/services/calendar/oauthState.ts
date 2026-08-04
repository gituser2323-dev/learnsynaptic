import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getOAuthStateSecret } from "@/config/calendar";

/**
 * Calendar & Meeting Connectors (Module 6.3) — the OAuth `state`
 * parameter's real job: proving the callback request actually
 * originated from an authorize redirect this app itself issued, not a
 * forged/replayed request an attacker crafted (CSRF on the OAuth
 * callback). Same HMAC-over-a-payload-plus-expiry shape as
 * lib/services/storage/signedUrl.ts's local signed URLs — a different
 * purpose, the identical, already-proven pattern.
 */

const STATE_TTL_SECONDS = 600; // 10 minutes — generous enough for a real OAuth consent screen, short enough to bound replay risk.

function sign(providerId: string, nonce: string, expiresAt: number): string {
  return createHmac("sha256", getOAuthStateSecret()).update(`${providerId}:${nonce}:${expiresAt}`).digest("hex");
}

/** Returns an opaque, URL-safe state token embedding providerId +
 *  nonce + expiry + signature — self-contained, so no server-side
 *  session/store is needed to remember it between the authorize
 *  redirect and the callback request. */
export function createOAuthState(providerId: string): string {
  const nonce = randomBytes(16).toString("base64url");
  const expiresAt = Date.now() + STATE_TTL_SECONDS * 1000;
  const signature = sign(providerId, nonce, expiresAt);
  return Buffer.from(JSON.stringify({ providerId, nonce, expiresAt, signature })).toString("base64url");
}

/** Returns the verified providerId, or null if the state is malformed,
 *  expired, or its signature doesn't match — the callback route treats
 *  any of these identically (see OAuthStateInvalidError). */
export function verifyOAuthState(state: string): string | null {
  let parsed: { providerId?: unknown; nonce?: unknown; expiresAt?: unknown; signature?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const { providerId, nonce, expiresAt, signature } = parsed;
  if (typeof providerId !== "string" || typeof nonce !== "string" || typeof expiresAt !== "number" || typeof signature !== "string") {
    return null;
  }
  if (Date.now() > expiresAt) return null;

  const expected = sign(providerId, nonce, expiresAt);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  return providerId;
}
