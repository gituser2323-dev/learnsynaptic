export { withApiRoute } from "./withApiRoute";
export type { ApiRouteContext, WithApiRouteOptions } from "./withApiRoute";
export { apiSuccess, apiError } from "./response";
export { parseJsonBody } from "./dto";
export type { DtoValidator, DtoValidationResult } from "./dto";
export {
  ApiError,
  ValidationApiError,
  NotFoundApiError,
  RateLimitedError,
  ForbiddenApiError,
  UnauthorizedApiError,
  UpstreamServiceApiError,
  PlanEntitlementRequiredApiError,
  UsageLimitExceededApiError,
  PayloadTooLargeApiError,
  ServiceUnavailableApiError,
} from "./errors";
export type { ApiFieldError } from "./errors";
export { createRequestLogger } from "./logger";
export type { RequestLogger, LogFields } from "./logger";
export { parsePaginationParams } from "./pagination";
export type { PaginationParams, PaginatedResult } from "@/lib/pagination";
export { toCsv } from "./csv";
export type { CsvColumn } from "./csv";
export type { AdminRole, AuthContext } from "./roles";
export { AUTH_HEADER_USER_ID, AUTH_HEADER_EMAIL, AUTH_HEADER_ROLE } from "./roles";
export { setAuthCookies, clearAuthCookies } from "./cookies";

// Deliberately NOT exported: handleError.ts's handleApiError (an
// implementation detail of withApiRoute), rateLimit/inMemory.ts's
// concrete limiter (routes configure rate limiting via
// WithApiRouteOptions, never by importing a limiter directly), and
// roles.ts's getAuthContext/hasRequiredRole (routes configure role
// gating via WithApiRouteOptions.requiredRole, the same pattern). The
// AUTH_HEADER_* constants ARE exported: middleware.ts (project root,
// outside lib/api) needs them to inject the same header names
// getAuthContext() reads — the one intentional exception, since
// middleware.ts is the sole producer of what getAuthContext() consumes.
