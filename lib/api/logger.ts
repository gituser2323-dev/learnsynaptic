import { createLogger, type Logger, type LogFields } from "@/lib/logger";

/**
 * Per-request structured logger. Thin wrapper around lib/logger.ts's
 * shared primitive — the request-scoping (requestId/method/path on every
 * line) is the only thing specific to this layer. Public API unchanged
 * from before this file was refactored to share its core with
 * lib/services/auditLog: createRequestLogger()'s signature and behavior
 * are identical, so no caller (withApiRoute.ts, etc.) needed to change.
 */

export type RequestLogger = Logger;
export type { LogFields };

export function createRequestLogger(requestId: string, request: Request): RequestLogger {
  return createLogger({
    requestId,
    method: request.method,
    path: new URL(request.url).pathname,
  });
}
