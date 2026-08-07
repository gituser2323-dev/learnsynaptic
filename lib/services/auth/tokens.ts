import { SignJWT, jwtVerify } from "jose";
import { JWT_ACCESS_TOKEN_SECRET, JWT_ACCESS_TOKEN_TTL_SECONDS } from "@/config/auth";
import type { AccessTokenPayload, UserRole } from "./types";

/**
 * Access-token signing/verification only — jose, not jsonwebtoken,
 * because this file is imported from middleware.ts (Next.js Edge
 * runtime): jose's primitives are built on Web Crypto and run in both
 * the Node and Edge runtimes, where jsonwebtoken (Node-only, uses
 * node:crypto directly) would not.
 *
 * Refresh-token generation/hashing deliberately lives in a separate
 * file (refreshTokenCrypto.ts) that middleware never imports — see that
 * file's doc comment.
 */

const ALG = "HS256";
const secretKey = new TextEncoder().encode(JWT_ACCESS_TOKEN_SECRET);

export interface SignedAccessToken {
  token: string;
  expiresAt: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<SignedAccessToken> {
  const expiresAt = new Date(Date.now() + JWT_ACCESS_TOKEN_TTL_SECONDS * 1000);
  const token = await new SignJWT({
    email: payload.email,
    role: payload.role,
    organizationId: payload.organizationId,
    sessionId: payload.sessionId,
    platformRole: payload.platformRole,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey);
  return { token, expiresAt: expiresAt.toISOString() };
}

function isUserRole(value: unknown): value is UserRole {
  return value === "counsellor" || value === "manager" || value === "admin";
}

/** RC-6 — the only valid value today (see PlatformRole's own doc
 *  comment); anything else in a token's own `platformRole` claim
 *  (forged, or a hypothetical future removed value) is treated as
 *  absent, never trusted as-is. */
function isPlatformRole(value: unknown): value is AccessTokenPayload["platformRole"] {
  return value === "super_admin";
}

/**
 * Verifies signature + expiry and returns the normalized claims, or null
 * for anything invalid (expired, bad signature, malformed/missing
 * claims) — callers (middleware, getAuthContext) treat null uniformly as
 * "not authenticated," never distinguishing the specific failure reason
 * to the client.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: [ALG] });
    const { sub, email, role, organizationId, sessionId, platformRole } = payload;
    if (typeof sub !== "string" || typeof email !== "string" || !isUserRole(role)) {
      return null;
    }
    // organizationId/sessionId are present on every token this app
    // itself signs (see signAccessToken's own real callers) but
    // deliberately tolerated as absent here rather than rejecting the
    // whole token — see withApiRoute.ts's own doc comment on why
    // "authenticated, no org claim" (falls back to the deployment's
    // real default organization, resolved server-side) is a different,
    // valid case from "not authenticated at all" (no context
    // established). The same tolerance now applies to sessionId — a
    // token minted before RC-1 simply can't identify "this request's
    // own current session," which only degrades one convenience
    // feature (auto-excluding the current device from "log out all
    // others"), never authentication itself.
    return {
      sub,
      email,
      role,
      organizationId: typeof organizationId === "string" ? organizationId : undefined,
      sessionId: typeof sessionId === "string" ? sessionId : undefined,
      platformRole: isPlatformRole(platformRole) ? platformRole : undefined,
    };
  } catch {
    return null;
  }
}
