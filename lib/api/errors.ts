/**
 * Typed API error hierarchy. Route handlers (and anything they call)
 * throw these; lib/api/handleError.ts is the single place that turns one
 * into an HTTP response, so every route gets the same error shape
 * without repeating try/catch boilerplate per file.
 */

export interface ApiFieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors?: ApiFieldError[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationApiError extends ApiError {
  constructor(errors: ApiFieldError[]) {
    super("Validation failed", 400, errors);
    this.name = "ValidationApiError";
  }
}

export class NotFoundApiError extends ApiError {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`, 404, [{ field: "id", message: `${entity} not found.` }]);
    this.name = "NotFoundApiError";
  }
}

export class RateLimitedError extends ApiError {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests", 429, [{ field: "root", message: "Too many requests. Please try again shortly." }]);
    this.name = "RateLimitedError";
  }
}

export class ForbiddenApiError extends ApiError {
  constructor(message = "Access denied.") {
    super(message, 403, [{ field: "root", message }]);
    this.name = "ForbiddenApiError";
  }
}

/** A downstream/vendor call this app depends on failed or refused the
 *  request — e.g. a WhatsApp send rejected by Meta. Distinct from a
 *  ValidationApiError (400, this app's own input was malformed): the
 *  request this app sent was well-formed, the failure happened on the
 *  other side of the wire. 502 (Bad Gateway) is the closest standard
 *  status for "we're a gateway to an upstream that didn't cooperate." */
export class UpstreamServiceApiError extends ApiError {
  constructor(message: string) {
    super(message, 502, [{ field: "root", message }]);
    this.name = "UpstreamServiceApiError";
  }
}

/** Business OS Phase 8, Module 8.3 — thrown when an organization's
 *  current plan doesn't include a route's `requiredCapability`. 403,
 *  the same status ForbiddenApiError uses (a valid, authenticated
 *  session exists, it's the organization's own commercial entitlement
 *  that's insufficient) — but a distinct class so a client can tell
 *  "wrong role" apart from "plan doesn't include this feature" and
 *  render an upgrade prompt instead of a generic access-denied page. */
export class PlanEntitlementRequiredApiError extends ApiError {
  constructor(message = "This feature isn't included in your current plan.") {
    super(message, 403, [{ field: "root", message }]);
    this.name = "PlanEntitlementRequiredApiError";
  }
}

/** Business OS Phase 8, Module 8.3 — thrown when a usage-metered action
 *  would exceed the organization's plan limit. 402 (Payment Required)
 *  — the one standard HTTP status whose real semantics ("the resource
 *  requires payment/a plan upgrade to continue") match this case
 *  exactly, distinct from a 403 (access categorically denied) or a 429
 *  (temporary rate limit, retry later — this is neither: retrying
 *  won't help until either usage resets or the plan changes). */
export class UsageLimitExceededApiError extends ApiError {
  constructor(message: string, public readonly current: number, public readonly limit: number | null) {
    super(message, 402, [{ field: "root", message }]);
    this.name = "UsageLimitExceededApiError";
  }
}

/** Distinct from ForbiddenApiError: 401 means "no valid session at all"
 *  (missing/invalid/expired token, or — from /api/auth/login — wrong
 *  credentials); 403 means "a valid session exists, but its role doesn't
 *  meet this route's requiredRole." withApiRoute.ts picks between the
 *  two based on whether AuthContext.role is present at all. */
export class UnauthorizedApiError extends ApiError {
  constructor(errors: ApiFieldError[] = [{ field: "root", message: "Authentication required." }]) {
    super(errors[0]?.message ?? "Authentication required.", 401, errors);
    this.name = "UnauthorizedApiError";
  }
}

/** RC-2 — thrown by withApiRoute.ts's own early `Content-Length` check,
 *  before any handler reads the request body. 413, the standard status
 *  for "the request body is bigger than this server is willing to
 *  process" — distinct from ValidationApiError (400, a well-formed but
 *  semantically invalid body) since this is rejected without ever
 *  parsing the body at all. */
export class PayloadTooLargeApiError extends ApiError {
  constructor(message = "Request body is too large.") {
    super(message, 413, [{ field: "root", message }]);
    this.name = "PayloadTooLargeApiError";
  }
}
