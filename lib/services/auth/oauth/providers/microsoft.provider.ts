import { AUTH_MICROSOFT_OAUTH_CONFIG } from "@/config/identityOAuth";
import { OAUTH_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { OAuthProviderError, OAuthProviderNotConfiguredError } from "../errors";
import type { IdentityOAuthProvider, OAuthProfile } from "../types";

/**
 * RC-1 — Social Login: Microsoft. Plain `fetch` against Microsoft
 * identity platform v2.0 + Graph's own /me endpoint — no
 * `@microsoft/microsoft-graph-client` SDK, matching
 * microsoftGraph.provider.ts's own established convention.
 */

const GRAPH_ME_ENDPOINT = "https://graph.microsoft.com/v1.0/me";
const SCOPES = ["openid", "email", "profile", "User.Read"];

function tokenEndpoint(): string {
  return `https://login.microsoftonline.com/${AUTH_MICROSOFT_OAUTH_CONFIG.tenantId}/oauth2/v2.0/token`;
}
function authEndpoint(): string {
  return `https://login.microsoftonline.com/${AUTH_MICROSOFT_OAUTH_CONFIG.tenantId}/oauth2/v2.0/authorize`;
}

function assertConfigured(): void {
  const missing: string[] = [];
  if (!AUTH_MICROSOFT_OAUTH_CONFIG.clientId) missing.push("AUTH_MICROSOFT_CLIENT_ID");
  if (!AUTH_MICROSOFT_OAUTH_CONFIG.clientSecret) missing.push("AUTH_MICROSOFT_CLIENT_SECRET");
  if (!AUTH_MICROSOFT_OAUTH_CONFIG.redirectUri) missing.push("AUTH_MICROSOFT_REDIRECT_URI");
  if (missing.length > 0) throw new OAuthProviderNotConfiguredError("microsoft", `missing env vars: ${missing.join(", ")}`);
}

interface MsTokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

interface MsGraphMeResponse {
  id: string;
  mail?: string;
  userPrincipalName?: string;
  displayName?: string;
  error?: { message?: string };
}

export const microsoftOAuthProvider: IdentityOAuthProvider = {
  id: "microsoft",
  name: "Microsoft",

  isConfigured(): boolean {
    return Boolean(
      AUTH_MICROSOFT_OAUTH_CONFIG.clientId && AUTH_MICROSOFT_OAUTH_CONFIG.clientSecret && AUTH_MICROSOFT_OAUTH_CONFIG.redirectUri,
    );
  },

  getAuthorizationUrl(state: string): string {
    assertConfigured();
    const params = new URLSearchParams({
      client_id: AUTH_MICROSOFT_OAUTH_CONFIG.clientId,
      redirect_uri: AUTH_MICROSOFT_OAUTH_CONFIG.redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      response_mode: "query",
      state,
    });
    return `${authEndpoint()}?${params.toString()}`;
  },

  async exchangeCodeForAccessToken(code: string): Promise<string> {
    assertConfigured();
    const response = await fetch(tokenEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: AUTH_MICROSOFT_OAUTH_CONFIG.clientId,
        client_secret: AUTH_MICROSOFT_OAUTH_CONFIG.clientSecret,
        redirect_uri: AUTH_MICROSOFT_OAUTH_CONFIG.redirectUri,
        grant_type: "authorization_code",
        scope: SCOPES.join(" "),
      }),
      signal: AbortSignal.timeout(OAUTH_PROVIDER_TIMEOUT_MS),
    });
    const data = (await response.json()) as MsTokenResponse;
    if (!response.ok || !data.access_token) {
      throw new OAuthProviderError("microsoft", data.error_description || data.error || `token request failed (${response.status})`);
    }
    return data.access_token;
  },

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const response = await fetch(GRAPH_ME_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(OAUTH_PROVIDER_TIMEOUT_MS),
    });
    const data = (await response.json()) as MsGraphMeResponse;
    if (!response.ok || !data.id) {
      throw new OAuthProviderError("microsoft", data.error?.message || `/me request failed (${response.status})`);
    }
    const email = data.mail || data.userPrincipalName;
    if (!email) throw new OAuthProviderError("microsoft", "Microsoft account has no email on file.");
    return {
      providerAccountId: data.id,
      email,
      // Microsoft Graph's /me doesn't assert a verified-email flag the
      // way Google's OIDC userinfo does — a work/school account's
      // `mail`/`userPrincipalName` is managed by its own Azure AD tenant
      // admin, which this app treats as an acceptable equivalent, but
      // doesn't claim to be the SAME guarantee Google makes. Kept false
      // here rather than assumed true, since oauthService.ts never
      // relies on this field for trust decisions anyway (see its own
      // doc comment on why linking is always explicit).
      emailVerified: false,
      name: data.displayName,
    };
  },
};
