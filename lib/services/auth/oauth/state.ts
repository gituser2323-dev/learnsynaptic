import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getIdentityOAuthStateSecret } from "@/config/identityOAuth";
import type { OAuthProviderId } from "../types";

/**
 * RC-1 — Social Login's OAuth `state` parameter: proves a callback
 * request actually originated from an authorize redirect this app
 * itself issued (CSRF on the OAuth callback), and — since this state
 * also has to survive the "already logged in, connecting a second
 * provider" case — carries which of the two distinct outcomes the
 * callback should perform:
 *
 *   - "login": an unauthenticated visitor is signing in. The callback
 *     looks up the OAuthAccount by (provider, providerAccountId) and
 *     issues real session tokens for whatever User it's linked to.
 *   - "link": an ALREADY-authenticated user (their own userId embedded
 *     here at authorize time) is connecting a new provider identity to
 *     their existing account from Security Settings.
 *
 * Same HMAC-over-a-JSON-payload shape as calendar/oauthState.ts — self-
 * contained, so no server-side session/store is needed between the
 * authorize redirect and the callback request.
 */

const STATE_TTL_SECONDS = 600; // 10 minutes — generous for a real consent screen, short enough to bound replay risk.

export type OAuthIntent = "login" | "link";

interface StatePayload {
  providerId: OAuthProviderId;
  intent: OAuthIntent;
  /** Only present for intent "link" — whose account to attach the new
   *  OAuthAccount to. Absent for "login", where the account isn't known
   *  until the callback resolves the provider identity. */
  userId?: string;
  nonce: string;
  expiresAt: number;
}

function sign(payload: Omit<StatePayload, "nonce"> & { nonce: string }): string {
  const material = `${payload.providerId}:${payload.intent}:${payload.userId ?? ""}:${payload.nonce}:${payload.expiresAt}`;
  return createHmac("sha256", getIdentityOAuthStateSecret()).update(material).digest("hex");
}

export function createOAuthState(providerId: OAuthProviderId, intent: OAuthIntent, userId?: string): string {
  const nonce = randomBytes(16).toString("base64url");
  const expiresAt = Date.now() + STATE_TTL_SECONDS * 1000;
  const payload: StatePayload = { providerId, intent, userId, nonce, expiresAt };
  const signature = sign(payload);
  return Buffer.from(JSON.stringify({ ...payload, signature })).toString("base64url");
}

/** Returns the verified payload, or null if the state is malformed,
 *  expired, or its signature doesn't match — the callback route treats
 *  any of these identically. */
export function verifyOAuthState(state: string): { providerId: OAuthProviderId; intent: OAuthIntent; userId?: string } | null {
  let parsed: Partial<StatePayload> & { signature?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const { providerId, intent, userId, nonce, expiresAt, signature } = parsed;
  if (typeof providerId !== "string" || (intent !== "login" && intent !== "link")) return null;
  if (typeof nonce !== "string" || typeof expiresAt !== "number" || typeof signature !== "string") return null;
  if (userId !== undefined && typeof userId !== "string") return null;
  if (intent === "link" && !userId) return null;
  if (Date.now() > expiresAt) return null;

  const expected = sign({ providerId: providerId as OAuthProviderId, intent, userId, nonce, expiresAt });
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  return { providerId: providerId as OAuthProviderId, intent, userId };
}
