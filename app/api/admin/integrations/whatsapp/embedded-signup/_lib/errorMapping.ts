import { ValidationApiError, UpstreamServiceApiError, PlanEntitlementRequiredApiError } from "@/lib/api";
import { EmbeddedSignupError } from "@/lib/services/whatsapp";

/**
 * Business OS Phase 8, Module 8.5 — one place mapping
 * EmbeddedSignupError's own codes to real HTTP errors, the same
 * "shared error-mapping helper, not duplicated per route" precedent
 * app/api/admin/integrations/_lib/errorMapping.ts already established
 * for the generic Integrations Registry.
 */
export function throwForEmbeddedSignupError(error: unknown): never {
  if (error instanceof EmbeddedSignupError) {
    if (error.code === "not_entitled") throw new PlanEntitlementRequiredApiError(error.message);
    if (error.code === "not_configured" || error.code === "invalid_request" || error.code === "waba_mismatch" || error.code === "phone_already_connected" || error.code === "phone_not_found") {
      throw new ValidationApiError([{ field: "root", message: error.message }]);
    }
    // exchange_failed / discovery_failed / meta_unavailable — a real
    // Meta-side or network failure, not this app's own client error.
    throw new UpstreamServiceApiError(error.message);
  }
  throw error;
}
