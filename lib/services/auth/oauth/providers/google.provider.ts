import { AUTH_GOOGLE_OAUTH_CONFIG } from "@/config/identityOAuth";
import { OAUTH_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { OAuthProviderError, OAuthProviderNotConfiguredError } from "../errors";
import type { IdentityOAuthProvider, OAuthProfile } from "../types";

/**
 * RC-1 — Social Login: Google. Plain `fetch` against Google's
 * documented REST endpoints (OpenID Connect userinfo, not the Calendar
 * API this app's other Google adapter talks to) — no `googleapis` SDK,
 * matching googleCalendar.provider.ts's own established "hand-rolled
 * fetch unless the crypto itself is genuinely complex" convention.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const SCOPES = ["openid", "email", "profile"];

function assertConfigured(): void {
  const missing: string[] = [];
  if (!AUTH_GOOGLE_OAUTH_CONFIG.clientId) missing.push("AUTH_GOOGLE_CLIENT_ID");
  if (!AUTH_GOOGLE_OAUTH_CONFIG.clientSecret) missing.push("AUTH_GOOGLE_CLIENT_SECRET");
  if (!AUTH_GOOGLE_OAUTH_CONFIG.redirectUri) missing.push("AUTH_GOOGLE_REDIRECT_URI");
  if (missing.length > 0) throw new OAuthProviderNotConfiguredError("google", `missing env vars: ${missing.join(", ")}`);
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  error?: string;
  error_description?: string;
}

export const googleOAuthProvider: IdentityOAuthProvider = {
  id: "google",
  name: "Google",

  isConfigured(): boolean {
    return Boolean(AUTH_GOOGLE_OAUTH_CONFIG.clientId && AUTH_GOOGLE_OAUTH_CONFIG.clientSecret && AUTH_GOOGLE_OAUTH_CONFIG.redirectUri);
  },

  getAuthorizationUrl(state: string): string {
    assertConfigured();
    const params = new URLSearchParams({
      client_id: AUTH_GOOGLE_OAUTH_CONFIG.clientId,
      redirect_uri: AUTH_GOOGLE_OAUTH_CONFIG.redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      state,
    });
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  },

  async exchangeCodeForAccessToken(code: string): Promise<string> {
    assertConfigured();
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: AUTH_GOOGLE_OAUTH_CONFIG.clientId,
        client_secret: AUTH_GOOGLE_OAUTH_CONFIG.clientSecret,
        redirect_uri: AUTH_GOOGLE_OAUTH_CONFIG.redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(OAUTH_PROVIDER_TIMEOUT_MS),
    });
    const data = (await response.json()) as GoogleTokenResponse;
    if (!response.ok || !data.access_token) {
      throw new OAuthProviderError("google", data.error_description || data.error || `token request failed (${response.status})`);
    }
    return data.access_token;
  },

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(OAUTH_PROVIDER_TIMEOUT_MS),
    });
    const data = (await response.json()) as GoogleUserInfoResponse;
    if (!response.ok || !data.sub) {
      throw new OAuthProviderError("google", data.error_description || data.error || `userinfo request failed (${response.status})`);
    }
    if (!data.email) throw new OAuthProviderError("google", "Google account has no email on file.");
    return {
      providerAccountId: data.sub,
      email: data.email,
      emailVerified: Boolean(data.email_verified),
      name: data.name,
    };
  },
};
