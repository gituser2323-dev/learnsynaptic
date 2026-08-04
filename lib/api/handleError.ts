import type { NextResponse } from "next/server";
import { ApiError, RateLimitedError, UsageLimitExceededApiError } from "./errors";
import { apiError } from "./response";
import { errorTrackingService } from "@/lib/services/errorTracking";
import type { RequestLogger } from "./logger";

/**
 * Converts any thrown error into a response — the single place this
 * translation happens, so every route handler behind withApiRoute() gets
 * identical error behavior without repeating a catch block per file.
 *
 * RC-3 — `errorContext` threads requestId/route/organizationId/userId
 * through to errorTrackingService for the "unhandled" branch only: an
 * ApiError (400/401/403/404/429 — expected control flow the route
 * itself decided to reject) is never forwarded to an external tracker,
 * the same "only unexpected exceptions, not expected rejections"
 * convention every real APM applies. Only a genuinely unhandled
 * exception (a bug, a downstream provider/database failure) is.
 */
export function handleApiError(
  error: unknown,
  logger: RequestLogger,
  errorContext: { requestId: string; route: string; organizationId?: string; userId?: string },
): NextResponse {
  if (error instanceof ApiError) {
    logger.warn("request.handled_error", { status: error.status, message: error.message });
    // Business OS Phase 8, Module 8.3 — the mission's own "return
    // structured error information" for a usage-limit rejection,
    // without changing the shared {success:false, errors} envelope
    // every other route already depends on: current/limit ride as
    // response headers, the same "structured info alongside the
    // standard envelope" precedent RateLimitedError's own Retry-After
    // header already established.
    let headers: Record<string, string> | undefined;
    if (error instanceof RateLimitedError) {
      headers = { "Retry-After": String(error.retryAfterSeconds) };
    } else if (error instanceof UsageLimitExceededApiError) {
      headers = { "X-Usage-Current": String(error.current), "X-Usage-Limit": error.limit === null ? "unlimited" : String(error.limit) };
    }
    return apiError(error.errors ?? [{ field: "root", message: error.message }], error.status, headers);
  }

  logger.error("request.unhandled_error", {
    message: error instanceof Error ? error.message : String(error),
  });
  // Fire-and-forget, same discipline withApiRoute.ts's own
  // recordForbiddenAccess() call already applies: reporting this must
  // never delay the error response itself, and errorTrackingService
  // itself never throws (see its own doc comment) so there's nothing
  // here to catch.
  void errorTrackingService.captureException(error, {
    requestId: errorContext.requestId,
    route: errorContext.route,
    organizationId: errorContext.organizationId,
    userId: errorContext.userId,
    operation: "api.unhandled_error",
  });
  return apiError([{ field: "root", message: "Something went wrong. Please try again." }], 500);
}
