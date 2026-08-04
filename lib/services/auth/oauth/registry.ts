import { googleOAuthProvider } from "./providers/google.provider";
import { microsoftOAuthProvider } from "./providers/microsoft.provider";
import { githubOAuthProvider } from "./providers/github.provider";
import type { IdentityOAuthProvider } from "./types";
import type { OAuthProviderId } from "../types";

/**
 * RC-1 — Social Login's Provider Registry. The one place allowed to
 * import a concrete adapter module — mirrors
 * lib/services/calendar/registry.ts exactly. oauthService.ts never
 * imports a provider module directly, and no UI component hardcodes
 * "Google"/"Microsoft"/"GitHub"; every caller asks this registry which
 * providers are actually configured.
 */
const OAUTH_PROVIDERS: Record<OAuthProviderId, IdentityOAuthProvider> = {
  google: googleOAuthProvider,
  microsoft: microsoftOAuthProvider,
  github: githubOAuthProvider,
};

export const OAUTH_PROVIDER_IDS: OAuthProviderId[] = Object.keys(OAUTH_PROVIDERS) as OAuthProviderId[];

export function isOAuthProviderId(value: string): value is OAuthProviderId {
  return (OAUTH_PROVIDER_IDS as string[]).includes(value);
}

export function getOAuthProvider(id: OAuthProviderId): IdentityOAuthProvider {
  return OAUTH_PROVIDERS[id];
}

/** "Do NOT hardcode providers" — the login page and Security Settings'
 *  Connected Accounts panel both call this instead of listing vendors
 *  themselves. A provider with no client id/secret configured
 *  (config/identityOAuth.ts) simply doesn't appear. */
export function listConfiguredOAuthProviders(): { id: OAuthProviderId; name: string }[] {
  return OAUTH_PROVIDER_IDS.filter((id) => OAUTH_PROVIDERS[id].isConfigured()).map((id) => ({
    id,
    name: OAUTH_PROVIDERS[id].name,
  }));
}
