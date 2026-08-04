import { AUTH_GITHUB_OAUTH_CONFIG } from "@/config/identityOAuth";
import { OAUTH_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { OAuthProviderError, OAuthProviderNotConfiguredError } from "../errors";
import type { IdentityOAuthProvider, OAuthProfile } from "../types";

/**
 * RC-1 — Social Login: GitHub. Named in the mission as "optional
 * architecture" — a real, working adapter (not a stub), gated the
 * identical way Google/Microsoft are: absent env vars means
 * isConfigured() returns false and no "Sign in with GitHub" button ever
 * renders (see oauth/registry.ts). GitHub's own OAuth apps don't
 * require the GitHub Apps/Marketplace review Google/Microsoft's
 * consumer-facing consent screens do, making it a reasonable
 * lowest-friction "optional" third choice for a deployment that wants
 * one.
 */

const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const AUTH_ENDPOINT = "https://github.com/login/oauth/authorize";
const USER_ENDPOINT = "https://api.github.com/user";
const EMAILS_ENDPOINT = "https://api.github.com/user/emails";
const SCOPES = ["read:user", "user:email"];

function assertConfigured(): void {
  const missing: string[] = [];
  if (!AUTH_GITHUB_OAUTH_CONFIG.clientId) missing.push("AUTH_GITHUB_CLIENT_ID");
  if (!AUTH_GITHUB_OAUTH_CONFIG.clientSecret) missing.push("AUTH_GITHUB_CLIENT_SECRET");
  if (!AUTH_GITHUB_OAUTH_CONFIG.redirectUri) missing.push("AUTH_GITHUB_REDIRECT_URI");
  if (missing.length > 0) throw new OAuthProviderNotConfiguredError("github", `missing env vars: ${missing.join(", ")}`);
}

interface GitHubTokenResponse {
  access_token: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  name?: string;
  email?: string | null;
}

interface GitHubEmailEntry {
  email: string;
  primary: boolean;
  verified: boolean;
}

export const githubOAuthProvider: IdentityOAuthProvider = {
  id: "github",
  name: "GitHub",

  isConfigured(): boolean {
    return Boolean(AUTH_GITHUB_OAUTH_CONFIG.clientId && AUTH_GITHUB_OAUTH_CONFIG.clientSecret && AUTH_GITHUB_OAUTH_CONFIG.redirectUri);
  },

  getAuthorizationUrl(state: string): string {
    assertConfigured();
    const params = new URLSearchParams({
      client_id: AUTH_GITHUB_OAUTH_CONFIG.clientId,
      redirect_uri: AUTH_GITHUB_OAUTH_CONFIG.redirectUri,
      scope: SCOPES.join(" "),
      state,
    });
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  },

  async exchangeCodeForAccessToken(code: string): Promise<string> {
    assertConfigured();
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        code,
        client_id: AUTH_GITHUB_OAUTH_CONFIG.clientId,
        client_secret: AUTH_GITHUB_OAUTH_CONFIG.clientSecret,
        redirect_uri: AUTH_GITHUB_OAUTH_CONFIG.redirectUri,
      }),
      signal: AbortSignal.timeout(OAUTH_PROVIDER_TIMEOUT_MS),
    });
    const data = (await response.json()) as GitHubTokenResponse;
    if (!response.ok || !data.access_token) {
      throw new OAuthProviderError("github", data.error_description || data.error || `token request failed (${response.status})`);
    }
    return data.access_token;
  },

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" };
    const userResponse = await fetch(USER_ENDPOINT, { headers, signal: AbortSignal.timeout(OAUTH_PROVIDER_TIMEOUT_MS) });
    const user = (await userResponse.json()) as GitHubUserResponse;
    if (!userResponse.ok || !user.id) {
      throw new OAuthProviderError("github", `/user request failed (${userResponse.status})`);
    }

    // GitHub's /user.email is null when the user's email is private —
    // the real, documented reason a second call to /user/emails is
    // needed to find a usable (and verified) address.
    let email = user.email ?? undefined;
    let emailVerified = false;
    if (email) {
      emailVerified = true; // GitHub only ever returns a *verified* address on the primary /user resource when public.
    } else {
      const emailsResponse = await fetch(EMAILS_ENDPOINT, { headers, signal: AbortSignal.timeout(OAUTH_PROVIDER_TIMEOUT_MS) });
      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as GitHubEmailEntry[];
        const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
        if (primary) {
          email = primary.email;
          emailVerified = true;
        }
      }
    }
    if (!email) throw new OAuthProviderError("github", "GitHub account has no verified email available.");

    return {
      providerAccountId: String(user.id),
      email,
      emailVerified,
      name: user.name || user.login,
    };
  },
};
