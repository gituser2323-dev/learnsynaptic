import { getUserRepository, getOAuthAccountRepository, DuplicateKeyError } from "@/lib/db";
import type { AuditContext } from "@/lib/services/auditLog";
import { securityAuditLogService, SECURITY_AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { authService } from "./authService";
import { mfaService } from "./mfaService";
import { getOAuthProvider, isOAuthProviderId, listConfiguredOAuthProviders } from "./oauth/registry";
import { createOAuthState, verifyOAuthState, type OAuthIntent } from "./oauth/state";
import { createOAuthMfaPendingToken, verifyOAuthMfaPendingToken } from "./oauth/mfaPending";
import {
  IdentityOAuthStateInvalidError,
  OAuthAccountAlreadyLinkedError,
  OAuthAccountDisabledError,
  OAuthAccountNotLinkedError,
  OAuthProviderNotConfiguredError,
} from "./oauth/errors";
import type { OAuthAccount, OAuthProviderId, User, AuthTokens } from "./types";
import { toPublicUser } from "./types";

/**
 * RC-1 — Social Login (Google real, Microsoft real, GitHub optional).
 *
 * Deliberately closed-world: a "login" callback NEVER auto-provisions a
 * new User, and NEVER auto-links an OAuthAccount to an existing User by
 * matching email addresses. LearnSynaptic is an invite-only staff CRM
 * (there is no public self-registration route at all — see
 * authService.createUser()'s own doc comment: it's only ever called
 * from scripts/createAdminUser.ts or an admin-only staff-management
 * route), so a brand-new OAuth identity has no account to create itself
 * INTO. And email-match auto-linking is a real, well-documented account-
 * takeover vector: it trusts the OAuth provider's own "is this email
 * verified" claim as proof of who should own the LearnSynaptic account
 * with that email — a claim that's either absent (Microsoft Graph's
 * /me), or present but a different provider's OWN administrators'
 * word to take (Google). Instead, linking only ever happens through the
 * explicit, AUTHENTICATED "link" intent below: a user who is already
 * logged in (with a real, admin-provisioned account) connects a new
 * provider identity to their OWN account from Security Settings. This
 * is slower for a brand-new hire's very first sign-in (they must use
 * their admin-set password once, then optionally connect a provider)
 * but never creates the ambiguity a "sign in with any Google account
 * matching this email" flow would.
 */

export interface OAuthProviderSummary {
  id: OAuthProviderId;
  name: string;
}

export type OAuthCallbackResult =
  | { intent: "login"; mfaRequired: false; user: ReturnType<typeof toPublicUser>; tokens: AuthTokens; newDevice: boolean }
  | { intent: "login"; mfaRequired: true; pendingToken: string }
  | { intent: "link"; account: OAuthAccount };

function assertProviderId(providerId: string): asserts providerId is OAuthProviderId {
  if (!isOAuthProviderId(providerId)) throw new OAuthProviderNotConfiguredError(providerId as OAuthProviderId, "unknown provider");
}

export const oauthService = {
  /** Login page / Connected Accounts panel data source — "Do NOT
   *  hardcode providers": only vendors with real credentials configured
   *  (config/identityOAuth.ts) are ever returned. */
  listProviders(): OAuthProviderSummary[] {
    return listConfiguredOAuthProviders();
  },

  /** `linkingUserId` set = "link" intent (an authenticated user
   *  connecting a new provider to their own account); omitted = "login"
   *  intent (an unauthenticated visitor signing in). The caller (the
   *  authorize route) decides which by checking the access-token cookie
   *  itself — see that route's own doc comment on why it can't rely on
   *  middleware/requiredRole for this. */
  beginAuthorization(providerId: string, linkingUserId?: string): string {
    assertProviderId(providerId);
    const provider = getOAuthProvider(providerId);
    const intent: OAuthIntent = linkingUserId ? "link" : "login";
    const state = createOAuthState(providerId, intent, linkingUserId);
    return provider.getAuthorizationUrl(state);
  },

  async handleCallback(providerId: string, code: string, state: string, context: AuditContext = {}): Promise<OAuthCallbackResult> {
    assertProviderId(providerId);
    const verifiedState = verifyOAuthState(state);
    if (!verifiedState || verifiedState.providerId !== providerId) throw new IdentityOAuthStateInvalidError();

    const provider = getOAuthProvider(providerId);
    const accessToken = await provider.exchangeCodeForAccessToken(code);
    const profile = await provider.fetchProfile(accessToken);

    const oauthAccountRepository = await getOAuthAccountRepository();
    const userRepository = await getUserRepository();

    if (verifiedState.intent === "link") {
      const linkingUserId = verifiedState.userId!;
      const existing = await oauthAccountRepository.findByProviderAccount(providerId, profile.providerAccountId);
      if (existing) {
        if (existing.userId !== linkingUserId) throw new OAuthAccountAlreadyLinkedError(providerId);
        return { intent: "link", account: existing }; // already linked to this same user — idempotent no-op.
      }

      try {
        const account = await oauthAccountRepository.create({
          userId: linkingUserId,
          provider: providerId,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
        });
        await securityAuditLogService.record({
          action: SECURITY_AUDIT_ACTIONS.OAUTH_ACCOUNT_LINKED,
          entityType: "User",
          entityId: linkingUserId,
          actorId: linkingUserId,
          actorType: "user",
          requestId: context.requestId,
          metadata: { provider: providerId, ipAddress: context.ipAddress },
        });
        return { intent: "link", account };
      } catch (error) {
        if (error instanceof DuplicateKeyError) throw new OAuthAccountAlreadyLinkedError(providerId);
        throw error;
      }
    }

    // intent === "login"
    const account = await oauthAccountRepository.findByProviderAccount(providerId, profile.providerAccountId);
    if (!account) throw new OAuthAccountNotLinkedError(providerId);

    const user = await userRepository.findById(account.userId);
    if (!user || user.status !== "active") throw new OAuthAccountDisabledError();

    if (user.mfaEnabled) {
      return { intent: "login", mfaRequired: true, pendingToken: createOAuthMfaPendingToken(user.id, providerId) };
    }

    const session = await authService.issueSessionForVerifiedUser(user, `oauth:${providerId}`, context);
    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.OAUTH_LOGIN_SUCCEEDED,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorType: "user",
      requestId: context.requestId,
      metadata: { provider: providerId, ipAddress: context.ipAddress },
    });
    return { intent: "login", mfaRequired: false, ...session };
  },

  /** Redeems an oauth/mfaPending.ts token (see that module's own doc
   *  comment for why this two-step shape exists) together with a real
   *  MFA code, via the exact same TOTP/recovery/email-OTP verification
   *  chain authService.login() itself uses. */
  async completeMfaChallenge(
    pendingToken: string,
    mfaCode: string,
    providerId: string,
    context: AuditContext = {},
  ): Promise<{ success: true; user: ReturnType<typeof toPublicUser>; tokens: AuthTokens; newDevice: boolean } | { success: false; error: string }> {
    if (!isOAuthProviderId(providerId)) return { success: false, error: "Unknown provider." };

    const userId = verifyOAuthMfaPendingToken(pendingToken, providerId);
    if (!userId) return { success: false, error: "This sign-in attempt has expired. Please try again." };

    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    if (!user || user.status !== "active") return { success: false, error: "This account is disabled." };

    const ok = await mfaService.verifyCode(userId, mfaCode);
    if (!ok) {
      await securityAuditLogService.record({
        action: SECURITY_AUDIT_ACTIONS.MFA_CHALLENGE_FAILED,
        entityType: "User",
        entityId: userId,
        actorId: userId,
        actorType: "user",
        requestId: context.requestId,
        metadata: { ipAddress: context.ipAddress, authMethod: `oauth:${providerId}` },
      });
      return { success: false, error: "Invalid verification code." };
    }

    const session = await authService.issueSessionForVerifiedUser(user as User, `oauth:${providerId}`, context);
    return { success: true, ...session };
  },

  async listLinkedAccounts(userId: string): Promise<OAuthAccount[]> {
    const oauthAccountRepository = await getOAuthAccountRepository();
    return oauthAccountRepository.listByUserId(userId);
  },

  /** Ownership-verified — a user can only unlink their OWN provider
   *  connections, the same convention sessionService.revokeSession() /
   *  mfaService.revokeTrustedDevice() already establish. */
  async unlinkAccount(userId: string, accountId: string, context: AuditContext = {}): Promise<{ success: boolean }> {
    const oauthAccountRepository = await getOAuthAccountRepository();
    const accounts = await oauthAccountRepository.listByUserId(userId);
    const target = accounts.find((a) => a.id === accountId);
    if (!target) return { success: false };

    await oauthAccountRepository.delete(accountId);
    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.OAUTH_ACCOUNT_UNLINKED,
      entityType: "User",
      entityId: userId,
      actorId: userId,
      actorType: "user",
      requestId: context.requestId,
      metadata: { provider: target.provider },
    });
    return { success: true };
  },
};
