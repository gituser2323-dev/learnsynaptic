/**
 * Authentication — public surface (Module 9, extended by RC-1). Password
 * hashing, token signing internals, and refresh-token/opaque-token
 * crypto are implementation detail; callers use authService +
 * verifyAccessToken (+ RC-1's mfaService/oauthService/sessionService)
 * only — same enforcement pattern as every other service module in this
 * codebase.
 *
 * One deliberate exception: middleware.ts imports verifyAccessToken
 * directly from ./tokens instead of this barrel. This barrel also
 * exports authService, which pulls in lib/db (every repository,
 * several using node:crypto) — fine for Route Handlers (Node runtime),
 * but middleware.ts runs on the Edge runtime and that import graph
 * doesn't bundle there. tokens.ts alone only depends on jose and stays
 * edge-safe. See middleware.ts's own comment.
 */
export { authService } from "./authService";
export { mfaService } from "./mfaService";
export { sessionService } from "./sessionService";
export type { SessionSummary, LoginHistoryEntry } from "./sessionService";
export { oauthService } from "./oauthService";
export type { OAuthProviderSummary, OAuthCallbackResult } from "./oauthService";
export {
  IdentityOAuthStateInvalidError,
  OAuthAccountAlreadyLinkedError,
  OAuthAccountDisabledError,
  OAuthAccountNotLinkedError,
  OAuthProviderNotConfiguredError,
} from "./oauth/errors";
export { verifyAccessToken } from "./tokens";
export type {
  User,
  PublicUser,
  UserRole,
  UserStatus,
  UserRepository,
  CreateUserInput,
  UpdateUserInput,
  RefreshTokenRecord,
  RefreshTokenRepository,
  CreateRefreshTokenInput,
  SessionMetadata,
  LoginCredentials,
  LoginResult,
  RefreshResult,
  RefreshFailureReason,
  CreateUserResult,
  AuthTokens,
  AuthValidationError,
  AccessTokenPayload,
  PasswordResetToken,
  EmailVerificationToken,
  MfaRecoveryCode,
  TrustedDevice,
  OAuthAccount,
  OAuthProviderId,
} from "./types";
