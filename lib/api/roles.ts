import type { UserRole, PlatformRole } from "@/lib/services/auth";

export type AdminRole = UserRole;
export type { PlatformRole };

const ROLE_RANK: Record<AdminRole, number> = { counsellor: 1, manager: 2, admin: 3 };

export interface AuthContext {
  userId?: string;
  email?: string;
  role?: AdminRole;
  /** Business OS Phase 8, Module 8.1 — the trusted tenant identity for
   *  this request, same provenance as role (see AUTH_HEADER_ORG_ID's
   *  own doc below). May be absent even on an otherwise-authenticated
   *  context (userId/email/role all present) — see
   *  tokens.ts's own verifyAccessToken() doc comment — in which case
   *  withApiRoute.ts resolves the deployment's real default
   *  organization server-side rather than treating the request as
   *  unauthenticated. */
  organizationId?: string;
  /** RC-1 — this request's own current session (RefreshTokenRecord id),
   *  same trusted-header provenance as everything else here. Absent for
   *  a token minted before this field existed — see tokens.ts's own
   *  verifyAccessToken() doc comment. */
  sessionId?: string;
  /** RC-6 — Platform Super Admin & SaaS Operations Console. A SEPARATE
   *  dimension from `role` above, never compared against it or folded
   *  into ROLE_RANK — see PlatformRole's own doc comment
   *  (lib/services/auth/types.ts) for why. Absent for every ordinary
   *  tenant user, forever. */
  platformRole?: PlatformRole;
}

/**
 * Trusted request headers middleware.ts injects after verifying the
 * access-token cookie's JWT signature — never read from a client-
 * supplied header directly. middleware.ts strips any client-sent
 * version of these headers before setting its own, so a client can never
 * spoof `x-auth-role: admin` by just sending the header itself.
 *
 * Authentication now has exactly one place it happens: middleware.ts.
 * getAuthContext() below only ever reads its output — it does not parse
 * cookies or verify a JWT itself. If a route's path isn't matched by
 * middleware.ts's matcher, no headers are ever set, and this returns an
 * empty context — the same fail-closed default this file has always had
 * (see hasRequiredRole below), now backed by a real mechanism instead of
 * an always-empty stub.
 */
export const AUTH_HEADER_USER_ID = "x-auth-user-id";
export const AUTH_HEADER_EMAIL = "x-auth-email";
export const AUTH_HEADER_ROLE = "x-auth-role";
/** Business OS Phase 8, Module 8.1 — carries the same verified JWT
 *  claim role/email/userId already do (see tokens.ts's own
 *  AccessTokenPayload doc). middleware.ts strips any client-sent copy
 *  before setting its own, identically to the other three headers. */
export const AUTH_HEADER_ORG_ID = "x-auth-org-id";
/** RC-1 — same trusted provenance as the other four headers. */
export const AUTH_HEADER_SESSION_ID = "x-auth-session-id";
/** RC-6 — same trusted provenance as the rest: middleware.ts strips any
 *  client-sent copy before setting its own, from the verified JWT's own
 *  `platformRole` claim (tokens.ts). Absent whenever the claim is
 *  absent — never defaulted to a value. */
export const AUTH_HEADER_PLATFORM_ROLE = "x-auth-platform-role";

function isAdminRole(value: string | null): value is AdminRole {
  return value === "counsellor" || value === "manager" || value === "admin";
}

function isPlatformRoleHeader(value: string | null): value is PlatformRole {
  return value === "super_admin";
}

export function getAuthContext(headers: Headers): AuthContext {
  const userId = headers.get(AUTH_HEADER_USER_ID);
  const email = headers.get(AUTH_HEADER_EMAIL);
  const role = headers.get(AUTH_HEADER_ROLE);
  if (!userId || !email || !isAdminRole(role)) return {};
  // organizationId/sessionId are genuinely optional here (see
  // AuthContext's own doc comment) — a real, authenticated session with
  // no org/session claim is NOT the same as no session at all.
  const organizationId = headers.get(AUTH_HEADER_ORG_ID) ?? undefined;
  const sessionId = headers.get(AUTH_HEADER_SESSION_ID) ?? undefined;
  const platformRoleHeader = headers.get(AUTH_HEADER_PLATFORM_ROLE);
  const platformRole = isPlatformRoleHeader(platformRoleHeader) ? platformRoleHeader : undefined;
  return { userId, email, role, organizationId, sessionId, platformRole };
}

/**
 * Rank-based: "admin" satisfies a route requiring "manager" or
 * "counsellor", but not the reverse. Existing routes built before real
 * auth existed (Admin Dashboard Backend, Marketing Dashboard) all use
 * requiredRole: "admin" — that's left unchanged by this module rather
 * than re-scoped to "manager"/"counsellor" per-route, since deciding
 * which of those two lower tiers should see e.g. bulk PII or revenue
 * figures is a product decision this module wasn't asked to make. The
 * three-tier hierarchy itself is fully real and independently verified
 * (see CHANGELOG) even though only "admin" is exercised by an existing
 * route today.
 */
export function hasRequiredRole(context: AuthContext, required: AdminRole): boolean {
  if (!context.role) return false;
  return ROLE_RANK[context.role] >= ROLE_RANK[required];
}

/**
 * RC-6 — deliberately NOT rank-based (there is only one platform role
 * today, but written as an exact-match check rather than a rank
 * comparison so introducing a lower "support"/"operations" tier later
 * doesn't silently grant it every route today's single tier can reach —
 * a future route would opt in explicitly). Critically: this NEVER reads
 * `context.role` — a tenant `admin` (`role: "admin"`, `platformRole:
 * undefined`) always fails this check, exactly the mission's own "a
 * tenant Admin must NEVER gain Platform Super Admin privileges"
 * requirement, enforced by construction (the two fields are read by
 * two entirely separate functions) rather than by remembering not to
 * conflate them.
 */
export function hasPlatformRole(context: AuthContext, required: PlatformRole): boolean {
  return context.platformRole === required;
}
