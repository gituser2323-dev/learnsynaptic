import { PayloadTooLargeApiError, ValidationApiError } from "./errors";
import type { ApiFieldError } from "./errors";

export type DtoValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: ApiFieldError[] };

export type DtoValidator<T> = (input: unknown) => DtoValidationResult<T>;

/** RC-2 — every JSON-bodied route in this app is a business-record
 *  payload (a lead, a campaign config, a CRM field update) — none
 *  legitimately approaches even 1MB, let alone withApiRoute.ts's own
 *  60MB global ceiling (sized for multipart file uploads, which never
 *  go through this function at all — see that file's own doc comment).
 *  A tighter, JSON-specific cap here is real defense-in-depth precision
 *  for the actual shape of this endpoint class, checked via the same
 *  Content-Length pre-check reasoning (and the same disclosed
 *  limitation: a request that lies about its own Content-Length isn't
 *  caught here either — see withApiRoute.ts). */
const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Safely parses a request body as JSON, throwing ValidationApiError (not
 * a raw exception) on malformed JSON. When `validate` is provided, also
 * validates the parsed shape and throws the same error type on failure —
 * this is the reusable DTO-validation seam for a future route that
 * doesn't have its own service-layer validator (lib/services/leads/
 * validation.ts already does this for /api/leads internally, so that
 * route calls this with no validator — see app/api/leads/route.ts).
 */
export async function parseJsonBody<T = unknown>(
  request: Request,
  validate?: DtoValidator<T>,
): Promise<T> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const bytes = Number(contentLength);
    if (Number.isFinite(bytes) && bytes > MAX_JSON_BODY_BYTES) {
      throw new PayloadTooLargeApiError();
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationApiError([{ field: "root", message: "Request body must be valid JSON." }]);
  }

  if (!validate) return body as T;

  const result = validate(body);
  if (!result.valid) {
    throw new ValidationApiError(result.errors);
  }
  return result.data;
}
