import { randomUUID } from "crypto";
import type { NextResponse } from "next/server";
import { createRequestLogger, type RequestLogger } from "./logger";
import { handleApiError } from "./handleError";
import {
  ForbiddenApiError,
  PayloadTooLargeApiError,
  PlanEntitlementRequiredApiError,
  RateLimitedError,
  ServiceUnavailableApiError,
  UnauthorizedApiError,
} from "./errors";
import { inMemoryRateLimiter } from "./rateLimit/inMemory";
import { getClientIp } from "./clientIp";
import { getAuthContext, hasRequiredRole, hasPlatformRole } from "./roles";
import { securityAuditLogService, SECURITY_AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { entitlementService, EntitlementError, type PlanCapability } from "@/lib/services/billing";
import { getUserRepository, getOrganizationRepository } from "@/lib/db";
import type { AdminRole, AuthContext, PlatformRole } from "./roles";


export interface ApiRouteContext {
  logger: RequestLogger;
  requestId: string;
  authContext: AuthContext;
  /** Next.js's dynamic route segment values (e.g. `{ id: "abc123" }` for
   *  a `[id]` path segment), resolved before the handler runs — empty
   *  object for routes with no dynamic segments. Added for the WhatsApp
   *  Campaign Manager, the first module in this codebase needing
   *  resource-scoped routes (`/api/admin/whatsapp-campaigns/[id]/...`);
   *  every pre-existing route is flat and simply never reads this. */
  params: Record<string, string>;
}

export interface WithApiRouteOptions {
  /** Per-route rate limit, keyed by client IP. Omit to skip rate limiting
   *  for routes that don't need it (e.g. a public read-only GET). */
  rateLimit?: { limit: number; windowMs: number };
  /** Minimum role required (rank-based — see roles.ts's ROLE_RANK).
   *  Enforced against AuthContext, which middleware.ts populates by
   *  verifying the access-token cookie; a request middleware.ts didn't
   *  authenticate carries no role and fails closed here regardless. */
  requiredRole?: AdminRole;
  /** Business OS Phase 8, Module 8.3 — the one route-declared gate for
   *  "does this organization's PLAN include this feature," parallel to
   *  `requiredRole`'s "does this USER's role allow it" — the mission's
   *  own explicit "avoid feature-check logic scattered throughout the
   *  application," resolved through `entitlementService`
   *  (`lib/services/billing`), never a hardcoded plan-name comparison.
   *  Checked AFTER tenant context is established (it needs a real
   *  organizationId) and after `requiredRole` (a role check is cheaper
   *  and more fundamental than a plan check, so it fails first). A
   *  request with no resolvable organizationId (genuinely unauthenticated)
   *  can't have this option meaningfully applied — such a route
   *  shouldn't set it. */
  requiredCapability?: PlanCapability;
  /** RC-6 — Platform Super Admin & SaaS Operations Console. A THIRD,
   *  entirely independent gate from `requiredRole` — see
   *  `hasPlatformRole`'s own doc comment (roles.ts) for why this never
   *  reads/compares against tenant `role`. A route setting this should
   *  almost never also set `requiredRole` (they answer different
   *  questions — "is this a platform operator" vs. "what tenant rank
   *  does this user hold" — and every platform route is about
   *  cross-tenant operations a tenant role is irrelevant to). Also
   *  enforces the mission's own explicit MFA requirement for the most
   *  privileged account class in the system: a platform route rejects
   *  the request (not just logs a warning) if the acting user's own
   *  `mfaEnabled` is false, even if `platformRole` matches — see
   *  `assertPlatformMfaSatisfied` below. */
  requiredPlatformRole?: PlatformRole;
}

type Handler = (request: Request, ctx: ApiRouteContext) => Promise<NextResponse>;

/** What Next.js passes as a route handler's second argument on a
 *  dynamic route segment — undefined for a flat route. */
type RouteSegmentArg = { params: Promise<Record<string, string>> } | undefined;

/** RC-2 — one global request-size ceiling applied before ANY route
 *  handler reads the body, uniformly across every one of this app's
 *  ~150 routes: an oversized request is rejected with 413 before it
 *  can consume memory/CPU parsing a multi-hundred-MB JSON or multipart
 *  body. Sized generously above the largest legitimate upload this app
 *  accepts (fileStorageService's own 50MB VIDEO/EXPORT ceiling — see
 *  lib/services/storage/validation.ts's MAX_SIZE_BYTES_BY_CATEGORY —
 *  plus multipart boundary/header overhead), so no real upload is ever
 *  rejected here; per-category limits inside validateUpload() remain
 *  the real, precise size gate for uploads specifically. Pure-JSON
 *  routes never legitimately approach this size at all — this is a
 *  DoS backstop, not a per-route size policy.
 *
 *  KNOWN LIMITATION, disclosed the same way inMemoryRateLimiter's own
 *  doc comment discloses its per-process limitation: this checks the
 *  client-supplied `Content-Length` header, which a request that
 *  actually streams more bytes than it declares (or omits the header
 *  entirely, e.g. chunked transfer-encoding) can bypass at this layer.
 *  A real production deployment's own reverse proxy/platform (Vercel,
 *  nginx, etc.) already enforces its own hard request-size ceiling
 *  independent of this app's code — this check is a real, cheap
 *  defense-in-depth layer for the common case, not the only layer. */
const MAX_REQUEST_BODY_BYTES = 60 * 1024 * 1024;

function isRequestBodyTooLarge(request: Request): boolean {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return false;
  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > MAX_REQUEST_BODY_BYTES;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** RC-5 — Backup, Restore & Disaster Recovery: the evaluated-and-
 *  deliberately-minimal "recovery mode" this mission's own instruction
 *  asks for. NOT a full maintenance-mode platform (no DB-backed flag,
 *  no admin UI toggle, no per-route allowlist beyond the two rules
 *  below) — see DR_RUNBOOK.md §14 for why a heavier mechanism wasn't
 *  built: this app's own restore procedure already avoids the main
 *  danger window architecturally (§3.2's restore tooling refuses to
 *  write over the live database without an explicit override — see
 *  scripts/db/restoreDatabase.ts). This is the cheap, real remainder:
 *  a single env var an operator can flip during an ACTIVELY UNFOLDING
 *  incident (suspected live data corruption, a security incident being
 *  contained) to freeze every write immediately, reversible by
 *  unsetting it and redeploying — no new infrastructure, no new
 *  moving part that could itself fail.
 *
 *  Read requests (GET/HEAD/OPTIONS) are never blocked — investigating
 *  an incident requires being able to read data. `auth.*`-named routes
 *  are exempt too — blocking login during an incident would be
 *  actively counterproductive (an operator needs to be able to sign in
 *  to investigate/respond at all). Every other mutating route is
 *  refused uniformly, before the handler ever runs. */
function isReadOnlyModeActive(): boolean {
  return process.env.MAINTENANCE_READ_ONLY_MODE === "true";
}

/** RC-6 — Platform Super Admin & SaaS Operations Console: TENANT
 *  suspension, a separate concept from §14's GLOBAL
 *  MAINTENANCE_READ_ONLY_MODE above (deployment-wide vs. one
 *  organization). Same shape, same exemptions (`GET`/`HEAD`/`OPTIONS`
 *  and `auth.*` routes always pass — a suspended org's users can still
 *  read their own data and sign in to see why, per the mission's own
 *  "historical data should remain intact" instruction), plus one more:
 *  a `requiredPlatformRole` route is NEVER blocked by this check — a
 *  platform operator's own request resolves to THEIR OWN tenant
 *  context (irrelevant to whatever org they're managing, which is
 *  identified by a route param/body, not this field), and blocking it
 *  would make it impossible to ever reactivate the very org this
 *  would otherwise freeze.
 *
 *  Deliberately does NOT block background jobs — the scheduler's own
 *  processing loop (schedulerService.ts's runDueScheduledJobs) checks
 *  organization status itself before executing a job, independently of
 *  this HTTP-request-only gate (see that file's own doc comment). */
async function assertOrganizationNotSuspended(organizationId: string): Promise<void> {
  const organizationRepository = await getOrganizationRepository();
  const organization = await organizationRepository.findById(organizationId);
  if (organization?.status === "suspended") {
    throw new ForbiddenApiError(
      "This organization's account is currently suspended. Contact support for assistance.",
    );
  }
}

/**
 * Wraps a route handler with the cross-cutting concerns every route
 * needs: structured request logging, optional rate limiting, optional
 * role gating, and uniform error handling (any thrown error — ApiError
 * or otherwise — becomes a correctly-shaped response via handleError.ts
 * instead of an unhandled 500 with a leaked stack trace).
 *
 * `routeName` is a stable label (e.g. "leads.create") used for rate-limit
 * bucket keys and log correlation — not derived from the URL, so it
 * stays stable if the route ever moves.
 */
export function withApiRoute(
  routeName: string,
  handler: Handler,
  options: WithApiRouteOptions = {},
): (request: Request, routeSegment?: RouteSegmentArg) => Promise<NextResponse> {
  return async function wrapped(request: Request, routeSegment?: RouteSegmentArg): Promise<NextResponse> {
    const requestId = randomUUID();
    const logger = createRequestLogger(requestId, request);
    const startedAt = Date.now();
    // RC-3 — hoisted above the try block (rather than declared where
    // it's resolved, further down) so the catch block below can still
    // read whatever value it reached before the throw — errorTracking
    // needs organizationId/userId even for an error thrown mid-request,
    // not just a clean success path.
    let organizationId: string | undefined;
    let userIdForErrorContext: string | undefined;

    try {
      if (!SAFE_METHODS.has(request.method) && !routeName.startsWith("auth.") && isReadOnlyModeActive()) {
        logger.warn("request.blocked_read_only_mode", { routeName, method: request.method });
        throw new ServiceUnavailableApiError();
      }

      if (isRequestBodyTooLarge(request)) {
        throw new PayloadTooLargeApiError();
      }

      const params = routeSegment ? await routeSegment.params : {};

      if (options.rateLimit) {
        const ip = getClientIp(request);
        const result = await inMemoryRateLimiter.check(
          `${routeName}:${ip}`,
          options.rateLimit.limit,
          options.rateLimit.windowMs,
        );
        if (!result.allowed) {
          throw new RateLimitedError(Math.ceil((result.resetAt - Date.now()) / 1000));
        }
      }

      const authContext = getAuthContext(request.headers);
      if (options.requiredRole && !hasRequiredRole(authContext, options.requiredRole)) {
        logger.warn("request.forbidden", { requiredRole: options.requiredRole, role: authContext.role });
        // Fire-and-forget: recording this must never delay or fail the
        // rejection response itself (securityAuditLogService.record()
        // never throws, but await it inline would still add latency to
        // every forbidden response for no benefit).
        void recordForbiddenAccess(routeName, authContext, options.requiredRole, requestId);
        throw authContext.role ? new ForbiddenApiError() : new UnauthorizedApiError();
      }

      if (options.requiredPlatformRole) {
        if (!hasPlatformRole(authContext, options.requiredPlatformRole)) {
          logger.warn("request.forbidden_platform", {
            requiredPlatformRole: options.requiredPlatformRole,
            platformRole: authContext.platformRole,
          });
          void recordForbiddenPlatformAccess(routeName, authContext, options.requiredPlatformRole, requestId);
          throw authContext.userId ? new ForbiddenApiError() : new UnauthorizedApiError();
        }
        // Fails closed on ANY lookup problem (missing user, DB hiccup) —
        // never treats "couldn't confirm MFA" as "MFA is fine." This is
        // the one gate in this file that does its own extra DB read
        // before the handler runs; justified by MFA being the mission's
        // own explicit requirement for the platform tier specifically,
        // the same "worth an extra async lookup per gated request"
        // trade-off `assertRequiredCapability` below already makes for
        // entitlements.
        await assertPlatformMfaSatisfied(authContext.userId!, routeName, requestId);
      }

      logger.info("request.start");
      // Business OS Phase 8, Module 8.1 — two genuinely different
      // "no organizationId" cases, handled differently:
      //
      //  1. Not authenticated at all (authContext.userId absent — no
      //     valid session token). Establishes NO context. A public,
      //     unauthenticated route (POST /api/leads, /api/registrations)
      //     has no session to derive identity from at all; those
      //     routes' own services (leadService.registerLead,
      //     registrationService's public create, etc.) stamp the
      //     deployment's default organization explicitly themselves —
      //     see leadService.ts's own doc comment on why that
      //     responsibility sits there, not here.
      //
      //  2. Authenticated, but the token carries no organizationId
      //     claim (userId present, organizationId absent). RC-7 changed
      //     what this means: `authService.ts`'s `resolveOrganizationId()`
      //     used to silently substitute the deployment's real default
      //     organization here ("a legacy token predating the field"),
      //     but that fallback is gone — confirmed against the live
      //     deployment that every real user already has an
      //     `organizationId` stamped at creation, so the ONLY way to
      //     reach this branch today is a genuinely brand-new,
      //     self-registered RC-7 account mid-onboarding, before it has
      //     created (or joined) an organization. Silently scoping such
      //     a request into the real default org's tenant context would
      //     be a cross-tenant leak (a stranger reading/writing
      //     LearnSynaptic's own production data); running the handler
      //     with NO tenant context at all would be worse
      //     (`tenantScopePlugin.ts`'s own doc comment: with no context
      //     active, every scoping hook is a no-op — an unscoped query
      //     against a tenant-owned collection returns EVERY
      //     organization's rows). So this case is rejected outright
      //     unless the route is explicitly safe for a pre-organization
      //     identity: `auth.*` (sign in/out/refresh/verify must keep
      //     working) and `onboarding.*` (the handful of routes that
      //     exist specifically to get this user out of this state —
      //     check onboarding status, create their organization). Both
      //     of those only ever touch `User`/`Organization`, neither of
      //     which is `tenantScopePlugin`-scoped (see that file's own
      //     module doc), so running them with no tenant context
      //     established is genuinely safe, not just convenient.
      organizationId = authContext.organizationId;
      if (authContext.userId && !organizationId) {
        // A `requiredPlatformRole` route is exempt for the same reason
        // the suspension check below is: a platform operator's own
        // request is about whatever org THEY specify via a route
        // param/body, never about their own (possibly nonexistent)
        // organizationId.
        if (!options.requiredPlatformRole && !routeName.startsWith("auth.") && !routeName.startsWith("onboarding.")) {
          logger.warn("request.forbidden_no_organization", { routeName });
          void recordForbiddenNoOrganizationAccess(routeName, authContext, requestId);
          throw new ForbiddenApiError("Complete your organization setup to continue.");
        }
      }
      userIdForErrorContext = authContext.userId;

      if (options.requiredCapability && !organizationId) {
        // A route declaring requiredCapability has no meaning without a
        // real tenant identity to check a plan against — this is a
        // route-configuration guarantee, not a real end-user path (see
        // the option's own doc comment).
        throw new UnauthorizedApiError();
      }

      if (
        organizationId &&
        !options.requiredPlatformRole &&
        !SAFE_METHODS.has(request.method) &&
        !routeName.startsWith("auth.")
      ) {
        await assertOrganizationNotSuspended(organizationId);
      }

      const response = organizationId
        ? await runWithTenantContext({ organizationId, userId: authContext.userId, role: authContext.role }, async () => {
            if (options.requiredCapability) {
              await assertRequiredCapability(organizationId!, options.requiredCapability);
            }
            return handler(request, { logger, requestId, authContext, params });
          })
        : await handler(request, { logger, requestId, authContext, params });
      logger.info("request.complete", { status: response.status, durationMs: Date.now() - startedAt });
      return response;
    } catch (error) {
      return handleApiError(error, logger, { requestId, route: routeName, organizationId, userId: userIdForErrorContext });
    }
  };
}

/** Business OS Phase 8, Module 8.3 — resolves the active organization's
 *  entitlements and throws `PlanEntitlementRequiredApiError` (403) if
 *  `requiredCapability` isn't included, the same "record then throw"
 *  shape `requiredRole`'s own rejection path above already takes. Not
 *  wired into `securityAuditLogService` (that registry is reserved for
 *  genuine RBAC/authentication security events — see its own module
 *  doc); a plan-entitlement rejection is a commercial/billing event,
 *  audited (if at all) by the calling service's own business-audit
 *  trail, not this cross-cutting layer. */
async function assertRequiredCapability(organizationId: string, capability: PlanCapability): Promise<void> {
  try {
    await entitlementService.assertCapability(organizationId, capability);
  } catch (error) {
    if (error instanceof EntitlementError) {
      throw new PlanEntitlementRequiredApiError(error.message);
    }
    throw error;
  }
}

/** This is where AUDIT_ARCHITECTURE.md's approved decision ("revisit
 *  rejected/failed requests once auth exists") gets fulfilled — the
 *  first, and only, security-audit producer triggered from within
 *  lib/api rather than a business service. */
async function recordForbiddenAccess(
  routeName: string,
  authContext: AuthContext,
  requiredRole: AdminRole,
  requestId: string,
): Promise<void> {
  await securityAuditLogService.record({
    action: SECURITY_AUDIT_ACTIONS.ACCESS_FORBIDDEN,
    entityType: "User",
    entityId: authContext.userId ?? "anonymous",
    actorId: authContext.userId,
    actorType: authContext.userId ? "user" : "api",
    requestId,
    metadata: { routeName, requiredRole, actualRole: authContext.role },
  });
}

/** RC-7 — the pre-organization-gate equivalent of recordForbiddenAccess
 *  above. A separate function for the same reason recordForbiddenPlatformAccess
 *  is: this metadata answers a different question ("did a mid-onboarding
 *  user try to reach a route their session genuinely can't touch yet,"
 *  not "did a tenant member of the wrong rank try to reach an
 *  admin-only route") — useful signal for RC-7's own onboarding-funnel/
 *  abandonment visibility (see platformAdmin's onboarding funnel view),
 *  not just a generic security log entry. */
async function recordForbiddenNoOrganizationAccess(routeName: string, authContext: AuthContext, requestId: string): Promise<void> {
  await securityAuditLogService.record({
    action: SECURITY_AUDIT_ACTIONS.ACCESS_FORBIDDEN,
    entityType: "User",
    entityId: authContext.userId ?? "anonymous",
    actorId: authContext.userId,
    actorType: authContext.userId ? "user" : "api",
    requestId,
    metadata: { routeName, reason: "no_organization" },
  });
}

/** RC-6 — the platform-gate equivalent of recordForbiddenAccess above.
 *  Deliberately a separate function (not an overload) so the recorded
 *  metadata shape stays specific to what a platform-access rejection
 *  actually needs to answer later ("was this a tenant admin probing
 *  /api/admin/platform/*, or a real platform operator who lost their
 *  privilege?") rather than reusing a shape designed for tenant-role
 *  rejections. */
async function recordForbiddenPlatformAccess(
  routeName: string,
  authContext: AuthContext,
  requiredPlatformRole: PlatformRole,
  requestId: string,
): Promise<void> {
  await securityAuditLogService.record({
    action: SECURITY_AUDIT_ACTIONS.ACCESS_FORBIDDEN,
    entityType: "User",
    entityId: authContext.userId ?? "anonymous",
    actorId: authContext.userId,
    actorType: authContext.userId ? "user" : "api",
    requestId,
    metadata: {
      routeName,
      requiredPlatformRole,
      actualPlatformRole: authContext.platformRole,
      actualRole: authContext.role,
      platformGate: true,
    },
  });
}

/** RC-6 — the mission's own explicit "require/verify MFA" instruction
 *  for the platform tier, enforced here rather than left to each
 *  platform route to remember. Fails closed on every branch: no user
 *  found, or `mfaEnabled` false, both reject — there is no "couldn't
 *  check, so let it through" path. This is the one place in this file
 *  that does a live DB read as part of a security gate (justified by
 *  MFA being genuinely security-critical for the most privileged
 *  account class in the system, not a convenience check). */
async function assertPlatformMfaSatisfied(userId: string, routeName: string, requestId: string): Promise<void> {
  const userRepository = await getUserRepository();
  const user = await userRepository.findById(userId);
  if (!user || !user.mfaEnabled) {
    await securityAuditLogService.record({
      action: SECURITY_AUDIT_ACTIONS.ACCESS_FORBIDDEN,
      entityType: "User",
      entityId: userId,
      actorId: userId,
      actorType: "user",
      requestId,
      metadata: { routeName, reason: "platform_mfa_not_enabled", platformGate: true },
    });
    throw new ForbiddenApiError("Platform access requires multi-factor authentication to be enabled on this account.");
  }
}
