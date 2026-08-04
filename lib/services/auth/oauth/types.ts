import type { OAuthProviderId } from "../types";

/** What every real adapter resolves after a successful token exchange —
 *  the minimal identity fields oauthService.ts needs to find/create the
 *  matching OAuthAccount. `emailVerified` matters: a provider that
 *  doesn't assert the email is verified (or an unverified result from
 *  one that does) must never be trusted for LINKING to an existing
 *  LearnSynaptic account by email-match — see oauthService.ts's own
 *  doc comment on why this app doesn't do that at all regardless, kept
 *  here anyway since it's a real, meaningful signal a future feature
 *  might reasonably use. */
export interface OAuthProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/** One real adapter per vendor (google.provider.ts / microsoft.provider.ts
 *  / github.provider.ts) — plain `fetch` against each vendor's
 *  documented REST endpoints, no vendor SDK dependency, the identical
 *  convention lib/services/calendar/providers/*.provider.ts already
 *  established for this codebase's other OAuth integrations. */
export interface IdentityOAuthProvider {
  readonly id: OAuthProviderId;
  readonly name: string;
  isConfigured(): boolean;
  getAuthorizationUrl(state: string): string;
  exchangeCodeForAccessToken(code: string): Promise<string>;
  fetchProfile(accessToken: string): Promise<OAuthProfile>;
}
