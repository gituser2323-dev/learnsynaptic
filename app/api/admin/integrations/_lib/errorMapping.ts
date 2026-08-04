import { ValidationApiError, NotFoundApiError } from "@/lib/api";
import type { IntegrationServiceError } from "@/lib/services/integrations";

/**
 * Shared by every integrations route that can fail with an
 * IntegrationServiceError (connect/disconnect/enabled/config) — one
 * place mapping the service's own error codes to HTTP errors, instead
 * of the same small switch duplicated four times. `_lib` (underscore
 * prefix) is excluded from Next.js's own route resolution, so this
 * file is never mistaken for a route.
 */
export function throwForIntegrationError(error: IntegrationServiceError, providerId: string): never {
  if (error.code === "not_found") throw new NotFoundApiError("Integration", providerId);
  if (error.code === "validation") throw new ValidationApiError(error.errors);
  // "built_in" and "not_connected" are both real client errors (acting
  // on a provider in a state that doesn't support the requested
  // action), not a 404/validation-shape failure.
  throw new ValidationApiError([{ field: "providerId", message: error.message }]);
}
