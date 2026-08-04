import type { NextResponse } from "next/server";
import {
  AUTH_ACCESS_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_PATH,
  AUTH_COOKIE_SECURE,
} from "@/config/auth";
import type { AuthTokens } from "@/lib/services/auth";

/**
 * Sets both auth cookies from a freshly issued token pair — the one
 * place this logic lives, shared by /api/auth/login and /api/auth/
 * refresh so the flag set can't drift between the two.
 *
 * httpOnly on both: neither token is ever readable from client-side JS
 * — the primary mitigation against token theft via XSS. sameSite: "lax"
 * allows normal same-site navigation/fetches to carry the cookie while
 * blocking it on a cross-site top-level navigation (CSRF surface
 * reduction) without "strict"'s extra friction (e.g. an external link
 * into the app landing already-logged-out).
 */
export function setAuthCookies(response: NextResponse, tokens: AuthTokens): void {
  const accessMaxAge = secondsUntil(tokens.accessTokenExpiresAt);
  const refreshMaxAge = secondsUntil(tokens.refreshTokenExpiresAt);

  response.cookies.set(AUTH_ACCESS_COOKIE_NAME, tokens.accessToken, {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });

  response.cookies.set(AUTH_REFRESH_COOKIE_NAME, tokens.refreshToken, {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: "lax",
    path: AUTH_REFRESH_COOKIE_PATH,
    maxAge: refreshMaxAge,
  });
}

/** Used by /api/auth/logout, and by /api/auth/refresh whenever the
 *  presented refresh token turns out invalid/expired/reused — clears
 *  both cookies so a rejected session doesn't linger client-side. */
export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(AUTH_ACCESS_COOKIE_NAME, "", {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(AUTH_REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: "lax",
    path: AUTH_REFRESH_COOKIE_PATH,
    maxAge: 0,
  });
}

function secondsUntil(isoTimestamp: string): number {
  return Math.max(0, Math.floor((new Date(isoTimestamp).getTime() - Date.now()) / 1000));
}
