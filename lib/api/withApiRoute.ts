import { randomUUID } from "crypto";
import type { NextResponse } from "next/server";
import { createRequestLogger, type RequestLogger } from "./logger";
import { handleApiError } from "./handleError";
import { ForbiddenApiError, PayloadTooLargeApiError, PlanEntitlementRequiredApiError, RateLimitedError, UnauthorizedApiError } from "./errors";
import { inMemoryRateLimiter } from "./rateLimit/inMemory";
import { getClientIp } from "./clientIp";
import { getAuthContext, hasRequiredRole } from "./roles";
import { securityAuditLogService, SECURITY_AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { ensureDefaultOrganization } from "@/lib/services/organizations";
import { entitlementService, EntitlementError, type PlanCapability } from "@/lib/services/billing";
import type { AdminRole, AuthContext } from "./roles";

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
      //     claim (userId present, organizationId absent — a legacy or
      //     test-minted token predating this field, or a real User row
      //     with none set yet — see tokens.ts's own verifyAccessToken
      //     doc). This is a real, verified identity that still needs a
      //     real tenant to operate in, so it resolves the deployment's
      //     one real default organization the exact same way
      //     authService.ts's own resolveOrganizationId() does for a
      //     real login — never a second, disconnected fake default.
      organizationId = authContext.organizationId;
      if (authContext.userId && !organizationId) {
        organizationId = (await ensureDefaultOrganization()).id;
      }
      userIdForErrorContext = authContext.userId;

      if (options.requiredCapability && !organizationId) {
        // A route declaring requiredCapability has no meaning without a
        // real tenant identity to check a plan against — this is a
        // route-configuration guarantee, not a real end-user path (see
        // the option's own doc comment).
        throw new UnauthorizedApiError();
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
