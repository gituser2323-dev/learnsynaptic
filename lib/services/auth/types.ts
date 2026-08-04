/**
 * Authentication domain layer (Module 9, extended by RC-1 — Production
 * Hardening: Authentication & Identity).
 *
 * RC-1 extends the existing entities (User, RefreshTokenRecord) rather
 * than replacing them, and adds five new, narrow entities for the
 * capabilities this app genuinely had no persistence for yet:
 * PasswordResetToken, EmailVerificationToken, MfaRecoveryCode,
 * TrustedDevice, OAuthAccount. Every new token-shaped entity follows the
 * exact same "opaque random value handed to the client, only its SHA-256
 * hash ever persisted" pattern RefreshTokenRecord already established —
 * no new crypto primitive invented, only new callers of it.
 */

// ─── User ────────────────────────────────────────────────────────────────

/** Rank order matters — see lib/api/roles.ts's ROLE_RANK. Counsellor is
 *  day-to-day (lowest), Manager is mid-tier, Admin is full access. */
export type UserRole = "counsellor" | "manager" | "admin";

export type UserStatus = "active" | "disabled";

export interface User {
  id: string;
  email: string;
  /** bcrypt hash — set once at creation, compared via password.ts's
   *  verifyPassword(). Never included in PublicUser. */
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  name?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  /** RC-1 — set the first time the user's email is verified (initial
   *  signup confirmation or a later re-verification after an email
   *  change). Undefined means never verified — the honest default for
   *  every account created before this field existed, not backfilled to
   *  a fabricated "already verified" value. */
  emailVerifiedAt?: string;
  /** RC-1 — brute-force protection. Reset to 0 on a successful login;
   *  incremented on each failed password check. Compared against
   *  `MAX_FAILED_LOGIN_ATTEMPTS` (authService.ts) to decide whether to
   *  set `lockedUntil`. */
  failedLoginAttempts: number;
  /** RC-1 — set when `failedLoginAttempts` crosses the threshold; login
   *  is rejected (a distinct, honest "too many attempts" message, not
   *  the generic invalid-credentials one) until this timestamp passes,
   *  then cleared automatically on the next login attempt regardless of
   *  outcome. */
  lockedUntil?: string;
  /** RC-1 — whether TOTP MFA is currently required at login for this
   *  account. `mfaSecretEncrypted` can exist (from a completed setup)
   *  while this is still false if the user hasn't finished enabling it
   *  — only a true value actually gates login. */
  mfaEnabled: boolean;
  /** RC-1 — AES-256-GCM ciphertext (mfaCrypto.ts) of the TOTP shared
   *  secret, the same "never a raw secret in a normal DB field"
   *  invariant every other encrypted-at-rest secret in this codebase
   *  already upholds (credentialCrypto.ts/tokenCrypto.ts/secretCrypto.ts
   *  precedent — this is the sixth independent copy of that same
   *  AES-256-GCM pattern, one per genuinely distinct secret purpose). */
  mfaSecretEncrypted?: string;
  /** RC-1 — bumped whenever the password actually changes (reset or
   *  self-service change) — surfaced in Security Settings as "last
   *  changed," and is what a future session-invalidation policy could
   *  key off if this app ever needs "log out everywhere on password
   *  change" (not built now — see authService's own disclosed scope
   *  note on why sessions aren't force-revoked on reset today). */
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** What every caller outside lib/services/auth actually gets — no
 *  passwordHash or mfaSecretEncrypted, ever. */
export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    emailVerified: Boolean(user.emailVerifiedAt),
    mfaEnabled: user.mfaEnabled,
  };
}

export interface CreateUserInput {
  email: string;
  /** Already hashed by the caller (authService.createUser calls
   *  password.ts's hashPassword() before this) — the repository layer
   *  is pure persistence, same as every other entity in this codebase. */
  passwordHash: string;
  role: UserRole;
  status?: UserStatus;
  name?: string;
  /** Business OS Phase 8, Module 8.3 — resolved by
   *  `authService.createUser()` before this ever reaches the
   *  repository (tenant context, falling back to the deployment's
   *  default organization for the script-bootstrap path — the same
   *  resolution `resolveOrganizationId()` already performs at
   *  token-issuance time). Real users created before this module
   *  shipped have none set — see `authService`'s own seat-count doc
   *  comment for the disclosed backward-compat consequence. */
  organizationId?: string;
}

/** RC-1 — the generic patch shape for every new mutable field added
 *  above. Deliberately additive to (never replacing) the existing
 *  dedicated `updatePassword()` method below — that method is already
 *  used and tested, and password hashing has its own real reason to
 *  stay a distinct call (it's the one field every caller must remember
 *  to pass through `hashPassword()` first, never raw). */
export interface UpdateUserInput {
  emailVerifiedAt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  mfaEnabled?: boolean;
  mfaSecretEncrypted?: string | null;
  passwordChangedAt?: string;
  name?: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Throws DuplicateKeyError (lib/db/types.ts) if the email already exists. */
  create(input: CreateUserInput): Promise<User>;
  /** RC-1 — used by authService.resetPassword()/changePassword(). Throws
   *  if no user exists with this id (mirrors update() on every other
   *  repository in this codebase). */
  updatePassword(id: string, passwordHash: string): Promise<User>;
  /** RC-1 — the one generic mutation path for every other new field;
   *  `null` on an optional field explicitly clears it (e.g. disabling
   *  MFA clears `mfaSecretEncrypted`), `undefined` leaves it untouched —
   *  the same "explicit clear vs. omit" convention this codebase's own
   *  Mongoose `$unset` precedent (phoneNumber.mongodb.repository.ts's
   *  own `clearOrganization()`) already established, since a plain
   *  `undefined` in a partial update object is otherwise ambiguous
   *  between the two. */
  update(id: string, patch: UpdateUserInput): Promise<User>;
  /** Enterprise CRM (Phase 1) — the staff directory Lead Assignment
   *  (manual + round robin) and Counsellor Tasks both need: "who can
   *  this be assigned to." Active users only. */
  listActive(): Promise<User[]>;
}

// ─── RefreshToken (Session) ─────────────────────────────────────────────

/** RC-1 — a session's own display metadata, captured once at issuance
 *  from the request that logged in (User-Agent header + resolved client
 *  IP) — see lib/api/userAgent.ts's own doc comment for the parser.
 *  Never re-derived or trusted from a later request; a session's own
 *  device identity doesn't change mid-life. */
export interface SessionMetadata {
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  /** SHA-256 hex of the raw opaque token — never the raw value. */
  tokenHash: string;
  /** Shared across every token descended from one login via rotation.
   *  Presenting an already-revoked token whose family is still active is
   *  the theft signal: authService revokes the entire family, not just
   *  that one record — see authService.ts's refreshSession(). */
  familyId: string;
  expiresAt: string;
  revokedAt?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  /** RC-1 — this session's own device/browser/OS/IP, shown verbatim in
   *  the Active Sessions admin panel. */
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  /** RC-1 — "Remember Me": a session created with this true gets the
   *  full `REFRESH_TOKEN_TTL_SECONDS` lifetime; false gets the shorter
   *  `REFRESH_TOKEN_TTL_SECONDS_SHORT` (config/auth.ts) — carried across
   *  rotation (issueTokens passes the prior session's own value forward)
   *  so "remember me" doesn't silently reset to the short TTL on the
   *  very first token refresh. */
  rememberMe: boolean;
  /** RC-1 — bumped on every successful refresh of this session (not on
   *  creation) — "last active" in the Active Sessions panel. Undefined
   *  for a session never refreshed yet. */
  lastUsedAt?: string;
  createdAt: string;
}

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: string;
  rememberMe: boolean;
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
}

export interface RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
  /** Used on reuse detection, and by the "log out all devices" flow
   *  below. */
  revokeFamily(familyId: string): Promise<void>;
  /** RC-1 — every session (revoked or not) belonging to a user, newest
   *  first — the Active Sessions panel's own data source. The service
   *  layer, not the repository, decides which rows count as "currently
   *  active" (not revoked, not expired) vs. history. */
  listByUserId(userId: string): Promise<RefreshTokenRecord[]>;
  /** RC-1 — "log out all other devices." Revokes every non-revoked
   *  session for this user except `exceptId` (the caller's own current
   *  session, when provided) — omit `exceptId` for a genuine "log out
   *  everywhere," e.g. from a password-reset or MFA-disable flow. */
  revokeAllForUser(userId: string, exceptId?: string): Promise<void>;
  /** RC-1 — updates `lastUsedAt` to now. Called on token rotation
   *  (refreshSession) for the OLD record just before it's revoked, so
   *  even a revoked history row shows when it was last actually used,
   *  not just when it was created. */
  touchLastUsed(id: string): Promise<void>;
}

// ─── PasswordResetToken ─────────────────────────────────────────────────

/** RC-1 — a real, self-service "forgot password" flow. Single-use (see
 *  `usedAt`), short-lived (`PASSWORD_RESET_TOKEN_TTL_SECONDS`,
 *  config/auth.ts), and — the same reason RefreshTokenRecord never
 *  stores a raw token — only `tokenHash` (SHA-256) is ever persisted,
 *  so a leaked database alone can't be used to reset an account's
 *  password. */
export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}

export interface CreatePasswordResetTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: string;
}

export interface PasswordResetTokenRepository {
  create(input: CreatePasswordResetTokenInput): Promise<PasswordResetToken>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
  markUsed(id: string): Promise<void>;
  /** Invalidates every OUTSTANDING (not yet used) reset token for a
   *  user — called before issuing a fresh one, so a user who requests
   *  "forgot password" twice can't have two simultaneously-valid links
   *  (an attacker who obtained an older, unused email couldn't use it
   *  after a newer request supersedes it). */
  invalidateOutstandingForUser(userId: string): Promise<void>;
}

// ─── EmailVerificationToken ─────────────────────────────────────────────

export interface EmailVerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}

export interface CreateEmailVerificationTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: string;
}

export interface EmailVerificationTokenRepository {
  create(input: CreateEmailVerificationTokenInput): Promise<EmailVerificationToken>;
  findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null>;
  markUsed(id: string): Promise<void>;
  invalidateOutstandingForUser(userId: string): Promise<void>;
}

// ─── MfaRecoveryCode ────────────────────────────────────────────────────

/** RC-1 — one row per recovery code (10 issued per MFA setup), the same
 *  "one revocable row per credential" shape RefreshTokenRecord already
 *  established, applied to a different credential kind. `codeHash` is
 *  SHA-256 of the real code (a short, human-typeable string, e.g.
 *  `xxxx-xxxx`, never a full random token — see mfaService.ts's own doc
 *  comment on the format), never the plaintext. */
export interface MfaRecoveryCode {
  id: string;
  userId: string;
  codeHash: string;
  usedAt?: string;
  createdAt: string;
}

export interface CreateMfaRecoveryCodeInput {
  userId: string;
  codeHash: string;
}

export interface MfaRecoveryCodeRepository {
  createMany(inputs: CreateMfaRecoveryCodeInput[]): Promise<MfaRecoveryCode[]>;
  findUnusedByUserId(userId: string): Promise<MfaRecoveryCode[]>;
  markUsed(id: string): Promise<void>;
  /** Called when MFA is disabled or regenerated — the old code set must
   *  never remain valid for a newly-generated one. */
  deleteAllForUser(userId: string): Promise<void>;
}

// ─── TrustedDevice (MFA) ────────────────────────────────────────────────

/** RC-1 — "remember this device for 30 days, skip MFA" — an opaque
 *  random token in a separate, long-lived cookie
 *  (`ls_mfa_trusted_device`), only its hash persisted, exactly the
 *  RefreshTokenRecord pattern again. Deliberately its own collection
 *  rather than reusing RefreshTokenRecord: a trusted-device grant and a
 *  login session are different lifetimes and different revocation
 *  triggers (disabling MFA must revoke every trusted device; logging
 *  out of one session must not). */
export interface TrustedDevice {
  id: string;
  userId: string;
  deviceTokenHash: string;
  expiresAt: string;
  deviceName?: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface CreateTrustedDeviceInput {
  userId: string;
  deviceTokenHash: string;
  expiresAt: string;
  deviceName?: string;
}

export interface TrustedDeviceRepository {
  create(input: CreateTrustedDeviceInput): Promise<TrustedDevice>;
  findByTokenHash(tokenHash: string): Promise<TrustedDevice | null>;
  touchLastUsed(id: string): Promise<void>;
  listByUserId(userId: string): Promise<TrustedDevice[]>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

// ─── MfaEmailOtp ─────────────────────────────────────────────────────────

/** RC-1 — MFA's email-OTP fallback for a user who hasn't set up an
 *  authenticator app. Deliberately its own entity rather than reusing
 *  EmailVerificationToken (a different credential, different lifecycle
 *  — verifying an address once vs. a fresh repeatable per-login code)
 *  or MfaRecoveryCode (pre-generated, long-lived backup credentials,
 *  not generated fresh per login attempt). */
export interface MfaEmailOtp {
  id: string;
  userId: string;
  codeHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}

export interface CreateMfaEmailOtpInput {
  userId: string;
  codeHash: string;
  expiresAt: string;
}

export interface MfaEmailOtpRepository {
  create(input: CreateMfaEmailOtpInput): Promise<MfaEmailOtp>;
  /** Only ever the most recently issued, unused code matters — a fresh
   *  request supersedes an outstanding one (invalidated by the service
   *  layer before issuing a new one, the same "supersede, don't stack"
   *  rule PasswordResetTokenRepository already establishes). */
  findLatestUnusedForUser(userId: string): Promise<MfaEmailOtp | null>;
  markUsed(id: string): Promise<void>;
  invalidateOutstandingForUser(userId: string): Promise<void>;
}

// ─── OAuthAccount (Social Login) ────────────────────────────────────────

/** RC-1 — the architecture named in the mission's own "do NOT hardcode
 *  providers" instruction: a closed union today (google/microsoft/
 *  github), but every provider-specific behavior lives in
 *  lib/services/auth/oauth/providers/*.ts, selected through a registry
 *  (the same "provider id -> concrete adapter" shape
 *  lib/services/whatsapp/registry.ts already established) — adding a
 *  fourth provider is a new adapter file plus one registry entry, never
 *  a change here. One User can link more than one provider (hence a
 *  dedicated collection, not fields on User itself) — `provider` +
 *  `providerAccountId` together are the real external identity;
 *  `email` is stored for display only (a provider's own account email
 *  can differ from the User's own login email if it was linked after
 *  the fact — a future feature this module doesn't build, disclosed
 *  rather than assumed). */
export type OAuthProviderId = "google" | "microsoft" | "github";

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: OAuthProviderId;
  providerAccountId: string;
  email?: string;
  createdAt: string;
}

export interface CreateOAuthAccountInput {
  userId: string;
  provider: OAuthProviderId;
  providerAccountId: string;
  email?: string;
}

export interface OAuthAccountRepository {
  create(input: CreateOAuthAccountInput): Promise<OAuthAccount>;
  findByProviderAccount(provider: OAuthProviderId, providerAccountId: string): Promise<OAuthAccount | null>;
  listByUserId(userId: string): Promise<OAuthAccount[]>;
  delete(id: string): Promise<void>;
}

// ─── Service-layer request/result shapes ────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
  /** RC-1 — "Remember Me" checkbox; also carries the TOTP/recovery code
   *  when MFA is required (see `LoginResult`'s own `mfa_required` case
   *  below — a second call to `login()` with the same credentials plus
   *  this field completes the flow, rather than a separate endpoint
   *  needing to re-verify the password). */
  rememberMe?: boolean;
  mfaCode?: string;
  /** RC-1 — the raw trusted-device cookie value, if present; verified
   *  against TrustedDeviceRepository to skip the MFA step entirely for
   *  a device that already completed it within the last 30 days. */
  trustedDeviceToken?: string;
}

export interface AuthValidationError {
  field: string;
  message: string;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  /** Raw, opaque — returned exactly once, at issuance. Only tokenHash is
   *  ever persisted. */
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export type LoginResult =
  | { success: true; user: PublicUser; tokens: AuthTokens; newDevice: boolean }
  /** RC-1 — password verified, but this account requires MFA and no
   *  valid code/trusted-device was presented — the client should now
   *  prompt for a code and retry `login()` with the same credentials
   *  plus `mfaCode` (or `trustedDeviceToken`). Deliberately NOT a
   *  separate "step 2" endpoint needing its own re-authentication:
   *  see mfaService.ts's own doc comment on why re-presenting the
   *  password is the safer shape (a short-lived "MFA pending" token
   *  would be one more bearer credential to protect, for no real
   *  benefit at this app's scale). */
  | { success: false; mfaRequired: true }
  | { success: false; locked: true; lockedUntil: string }
  | { success: false; errors: AuthValidationError[] };

export type CreateUserResult =
  | { success: true; user: PublicUser }
  | { success: false; errors: AuthValidationError[] };

export type RefreshFailureReason = "invalid" | "expired" | "reused" | "user_inactive";

export type RefreshResult =
  | { success: true; user: PublicUser; tokens: AuthTokens }
  | { success: false; reason: RefreshFailureReason };

/** The verified claims carried by an access token — what
 *  verifyAccessToken() returns, and what middleware forwards as trusted
 *  x-auth-* headers for getAuthContext() to read. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Required on every token this app's own signAccessToken() issues
   *  (see authService.ts's resolveOrganizationId()) — optional in the
   *  type only because verifyAccessToken() also has to accept tokens
   *  that omit it without rejecting them outright (see that function's
   *  own doc comment). */
  organizationId?: string;
  /** RC-1 — the issuing session's own RefreshTokenRecord id, so a route
   *  handler (e.g. "log out all OTHER devices") can identify "this
   *  request's own current session" without a second lookup. Absent on
   *  a token minted before this field existed — treated the same
   *  tolerant way `organizationId` already is. */
  sessionId?: string;
}
