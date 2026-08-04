/**
 * Integrations Hub (Phase 6), Module 6.1 — the one real guard behind
 * "do not store secrets directly in normal database fields." `config`
 * is genuinely generic (its shape varies per provider category), so
 * this can't validate against a fixed schema the way most of this
 * app's other validators do — instead it rejects any key *name* that
 * looks credential-shaped, on the theory that a real secret's key is
 * almost always named `apiKey`, `secret`, `token`, `password`, or
 * similar. Not cryptographically foolproof (a secret could be stored
 * under an oddly-named key), but a real, effective guard against the
 * common case, and the one this module's own security requirements
 * call for at this layer.
 */
const CREDENTIAL_LIKE_KEY_PATTERN = /key|secret|token|password|credential/i;

export interface IntegrationValidationError {
  field: string;
  message: string;
}

export function validateIntegrationConfig(config: unknown): { valid: true; data: Record<string, unknown> } | { valid: false; errors: IntegrationValidationError[] } {
  if (config === undefined || config === null) return { valid: true, data: {} };
  if (typeof config !== "object" || Array.isArray(config)) {
    return { valid: false, errors: [{ field: "config", message: "config must be a plain object." }] };
  }

  const errors: IntegrationValidationError[] = [];
  for (const key of Object.keys(config as Record<string, unknown>)) {
    if (CREDENTIAL_LIKE_KEY_PATTERN.test(key)) {
      errors.push({
        field: `config.${key}`,
        message: `"${key}" looks like a credential and can't be stored in config — use credentialRef to point at where the real value lives (an env var today).`,
      });
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: config as Record<string, unknown> };
}

/** Validates a client-supplied `credentialRef` into the real
 *  discriminated union rather than trusting an unchecked cast — the
 *  one field this module's own security requirements single out
 *  ("credential references"), so it gets real input validation like
 *  everything else, not a `as never` cast past the type system. */
export function validateCredentialRef(
  value: unknown,
): { valid: true; data: import("./types").IntegrationCredentialRef | undefined } | { valid: false; errors: IntegrationValidationError[] } {
  if (value === undefined) return { valid: true, data: undefined };
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { valid: false, errors: [{ field: "credentialRef", message: "credentialRef must be an object." }] };
  }

  const body = value as Record<string, unknown>;
  if (body.type === "none") return { valid: true, data: { type: "none" } };
  if (body.type === "env") {
    if (typeof body.description !== "string" || !body.description.trim()) {
      return { valid: false, errors: [{ field: "credentialRef.description", message: "credentialRef of type \"env\" requires a description." }] };
    }
    return { valid: true, data: { type: "env", description: body.description.trim() } };
  }
  if (body.type === "vault") {
    if (typeof body.ref !== "string" || !body.ref.trim()) {
      return { valid: false, errors: [{ field: "credentialRef.ref", message: "credentialRef of type \"vault\" requires a ref." }] };
    }
    return { valid: true, data: { type: "vault", ref: body.ref.trim() } };
  }
  /** Calendar & Meeting Connectors (Module 6.3) — the shape the OAuth
   *  callback route constructs server-side after a real token exchange
   *  (never expected from a hand-typed client request the way "env"/
   *  "vault" are). `accessToken`/`refreshToken` here are always
   *  AES-256-GCM ciphertext (see tokenCrypto.ts) by the time they reach
   *  this validator — this function only checks shape, not content; a
   *  malformed/non-ciphertext string still passes shape validation but
   *  fails cleanly at decrypt time later, never silently treated as a
   *  real usable token. */
  if (body.type === "oauth") {
    if (typeof body.provider !== "string" || !body.provider.trim()) {
      return { valid: false, errors: [{ field: "credentialRef.provider", message: "credentialRef of type \"oauth\" requires a provider." }] };
    }
    if (typeof body.accessToken !== "string" || !body.accessToken.trim()) {
      return { valid: false, errors: [{ field: "credentialRef.accessToken", message: "credentialRef of type \"oauth\" requires an accessToken." }] };
    }
    if (typeof body.expiresAt !== "string" || !body.expiresAt.trim()) {
      return { valid: false, errors: [{ field: "credentialRef.expiresAt", message: "credentialRef of type \"oauth\" requires an expiresAt." }] };
    }
    return {
      valid: true,
      data: {
        type: "oauth",
        provider: body.provider.trim(),
        accessToken: body.accessToken,
        refreshToken: typeof body.refreshToken === "string" && body.refreshToken ? body.refreshToken : undefined,
        expiresAt: body.expiresAt.trim(),
        scope: typeof body.scope === "string" && body.scope ? body.scope : undefined,
      },
    };
  }
  /** Generic Webhooks & Team Notifications (Module 6.5) — constructed
   *  server-side by webhookService after encrypting an admin-supplied
   *  Slack/Teams/Discord webhook URL (see secretCrypto.ts), the same
   *  "shape-only validation, real safety comes from decrypt-time
   *  failure on a malformed value" posture the "oauth" branch above
   *  already takes. */
  if (body.type === "webhook_url") {
    if (typeof body.encryptedUrl !== "string" || !body.encryptedUrl.trim()) {
      return { valid: false, errors: [{ field: "credentialRef.encryptedUrl", message: "credentialRef of type \"webhook_url\" requires an encryptedUrl." }] };
    }
    return { valid: true, data: { type: "webhook_url", encryptedUrl: body.encryptedUrl } };
  }
  /** Business OS Phase 8, Module 8.2 — constructed server-side by
   *  integrationService.setTenantCredentials() after encrypting an
   *  admin-supplied key→value credential map (see credentialCrypto.ts),
   *  the same "shape-only validation, real safety comes from
   *  decrypt-time failure on a malformed value" posture "oauth"/
   *  "webhook_url" above already take — never expected from a raw
   *  client connect-request body directly. */
  if (body.type === "tenant_secret") {
    if (typeof body.encryptedValues !== "object" || body.encryptedValues === null || Array.isArray(body.encryptedValues)) {
      return { valid: false, errors: [{ field: "credentialRef.encryptedValues", message: "credentialRef of type \"tenant_secret\" requires an encryptedValues object." }] };
    }
    const entries = Object.entries(body.encryptedValues as Record<string, unknown>);
    if (entries.length === 0 || entries.some(([, v]) => typeof v !== "string" || !v)) {
      return { valid: false, errors: [{ field: "credentialRef.encryptedValues", message: "encryptedValues must be a non-empty map of string values." }] };
    }
    return { valid: true, data: { type: "tenant_secret", encryptedValues: body.encryptedValues as Record<string, string> } };
  }
  return { valid: false, errors: [{ field: "credentialRef.type", message: "credentialRef.type must be one of: none, env, vault, oauth, webhook_url, tenant_secret." }] };
}
