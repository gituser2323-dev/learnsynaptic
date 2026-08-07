import { getIntegrationConnectionRepository, getIntegrationLogRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { getProviderDescriptor, INTEGRATION_PROVIDERS } from "./providerCatalog";
import { getBuiltInStatus } from "./builtInStatus";
import { validateIntegrationConfig, validateCredentialRef } from "./validation";
import { encryptCredentialValues } from "./credentialCrypto";
import type { PaginatedResult } from "@/lib/pagination";
import type { AuditContext } from "@/lib/services/auditLog";
import type {
  IntegrationConnection,
  IntegrationCredentialRef,
  IntegrationLog,
  IntegrationLogOutcome,
  IntegrationSummary,
} from "./types";

export type IntegrationServiceError =
  | { code: "not_found"; message: string }
  | { code: "built_in"; message: string }
  | { code: "not_connected"; message: string }
  | { code: "validation"; message: string; errors: { field: string; message: string }[] };

export type IntegrationResult<T> = { success: true; data: T } | { success: false; error: IntegrationServiceError };

const DEFAULT_CREDENTIAL_REF: IntegrationCredentialRef = { type: "none" };

/**
 * Business OS Phase 8, Module 8.2 — the mission's own explicit
 * requirement ("credential values must never be returned to the
 * frontend, logged, or included in audit payloads or API error
 * messages") applied at the one seam every API response and admin UI
 * render passes through. Replaces each stored value with a fixed
 * masked marker — key NAMES stay visible (harmless, e.g. "apiKey"),
 * so the UI can render "which fields are configured," but the
 * AES-256-GCM ciphertext itself never leaves the server. Does not
 * touch the pre-existing `oauth`/`webhook_url` variants (their own
 * ciphertext already reaches API responses today, a Module 6.3/6.5
 * behavior predating this module and unrelated to what 8.2 was asked
 * to build) — only the new `tenant_secret` shape this module owns.
 */
function maskCredentialRef(ref: IntegrationCredentialRef): IntegrationCredentialRef {
  if (ref.type !== "tenant_secret") return ref;
  return { type: "tenant_secret", encryptedValues: Object.fromEntries(Object.keys(ref.encryptedValues).map((key) => [key, "••••••••"])) };
}

function toSummary(
  providerId: string,
  connection: IntegrationConnection | null,
): IntegrationSummary | undefined {
  const provider = getProviderDescriptor(providerId);
  if (!provider) return undefined;

  if (provider.builtIn) {
    const builtIn = getBuiltInStatus(providerId);
    const isTenantConnected = connection?.credentialRef.type === "tenant_secret";
    /** Business OS Phase 8, Module 8.5 — a real, disclosed fix,
     *  deliberately scoped to `whatsapp` alone (an explicit providerId
     *  check, not inferred from `connection.status` — the repository's
     *  own `create()` unconditionally sets status:"connected" on first
     *  insert for EVERY provider, builtIn or not, so status alone can't
     *  distinguish "a real Embedded Signup connection" from "an org's
     *  very first OpenAI/Postmark tenant credential save"). Only
     *  `whatsapp` gets a real per-tenant connect/disconnect lifecycle in
     *  this app (Module 8.5) — email/openai/anthropic/gemini keep
     *  reading this deployment's own env-derived status exactly as
     *  Module 8.2 established, zero regression for providers Module 8.5
     *  never touches. For whatsapp, this is what makes "an org fully,
     *  correctly connected via its own real Meta credentials" show
     *  "connected" here even when this deployment's own WHATSAPP_PROVIDER
     *  env still says "console" — the bug this fix closes. */
    const preferTenantStatus = providerId === "whatsapp" && isTenantConnected;
    return {
      provider,
      status: preferTenantStatus ? connection.status : (builtIn?.status ?? "disconnected"),
      enabled: preferTenantStatus ? connection.enabled : (builtIn?.enabled ?? false),
      health: preferTenantStatus ? connection.health : (builtIn?.health ?? "unknown"),
      lastSuccessAt: preferTenantStatus ? connection.lastSuccessAt : undefined,
      lastFailureAt: preferTenantStatus ? connection.lastFailureAt : undefined,
      lastError: preferTenantStatus ? connection.lastError : undefined,
      config: connection?.config ?? {},
      /** Business OS Phase 8, Module 8.2 — a builtIn provider's live
       *  status/health above still comes from getBuiltInStatus() (env,
       *  read-only, unchanged since 6.1) — that's a statement about
       *  whether the platform-level integration is operational, not
       *  about which credential source it's currently using. Whether
       *  *this organization* has overridden it with its own
       *  tenant_secret is a separate, real fact worth surfacing so the
       *  admin UI can show "using your organization's credentials"
       *  instead of always claiming plain env config — see
       *  credentialResolver.ts, the actual reader that makes this true
       *  at request time, not just in this summary. */
      credentialRef: isTenantConnected
        ? maskCredentialRef(connection.credentialRef)
        : { type: "env", description: `Configured via environment variables — see config/${providerId === "whatsapp" ? "whatsapp" : providerId === "email" ? "emailChannel" : "aiInsights"}.ts.` },
    };
  }

  if (!connection) {
    return {
      provider,
      status: "disconnected",
      enabled: false,
      health: "unknown",
      config: {},
      credentialRef: DEFAULT_CREDENTIAL_REF,
    };
  }

  return {
    provider,
    status: connection.status,
    enabled: connection.enabled,
    health: connection.health,
    lastSuccessAt: connection.lastSuccessAt,
    lastFailureAt: connection.lastFailureAt,
    lastError: connection.lastError,
    config: connection.config,
    credentialRef: maskCredentialRef(connection.credentialRef),
  };
}

/**
 * Integrations Hub (Phase 6), Module 6.1 — the merged read model plus
 * the connect/disconnect/enable/disable/config lifecycle for every
 * non-builtIn provider. BuiltIn providers (WhatsApp/Email/AI) are
 * intentionally read-only through this service: their real connect/
 * disconnect lifecycle already lives in their own env config, and
 * duplicating a second "connect" path for them here would be exactly
 * the "duplicate connection logic" this module's own mission warns
 * against.
 */
export const integrationService = {
  async listIntegrations(): Promise<IntegrationSummary[]> {
    const repository = await getIntegrationConnectionRepository();
    const connections = await repository.list();
    const connectionByProvider = new Map(connections.map((c) => [c.providerId, c]));

    return INTEGRATION_PROVIDERS.map((provider) => toSummary(provider.id, connectionByProvider.get(provider.id) ?? null)).filter(
      (s): s is IntegrationSummary => s !== undefined,
    );
  },

  async getIntegration(providerId: string): Promise<IntegrationSummary | null> {
    const provider = getProviderDescriptor(providerId);
    if (!provider) return null;

    /** Business OS Phase 8, Module 8.2 — a builtIn provider can still
     *  have a real IntegrationConnection row (a tenant_secret override
     *  configured via setTenantCredentials()) even though it has no
     *  connect()/disconnect() lifecycle of its own — always look the
     *  row up rather than assuming builtIn implies "no connection
     *  exists," the bug this branch used to have. */
    const repository = await getIntegrationConnectionRepository();
    const connection = await repository.findByProviderId(providerId);
    return toSummary(providerId, connection) ?? null;
  },

  async connect(
    providerId: string,
    input: { config?: unknown; credentialRef?: unknown },
    context: AuditContext = {},
  ): Promise<IntegrationResult<IntegrationSummary>> {
    const provider = getProviderDescriptor(providerId);
    if (!provider) return { success: false, error: { code: "not_found", message: `Unknown integration provider "${providerId}".` } };
    if (provider.builtIn) {
      return {
        success: false,
        error: { code: "built_in", message: `${provider.name} is configured via environment variables, not this registry.` },
      };
    }

    const configValidation = validateIntegrationConfig(input.config);
    if (!configValidation.valid) {
      return { success: false, error: { code: "validation", message: "Invalid config.", errors: configValidation.errors } };
    }
    const credentialRefValidation = validateCredentialRef(input.credentialRef);
    if (!credentialRefValidation.valid) {
      return { success: false, error: { code: "validation", message: "Invalid credentialRef.", errors: credentialRefValidation.errors } };
    }

    const connectionRepository = await getIntegrationConnectionRepository();
    const logRepository = await getIntegrationLogRepository();
    const existing = await connectionRepository.findByProviderId(providerId);

    const connection = existing
      ? await connectionRepository.update(providerId, {
          status: "connected",
          enabled: true,
          config: configValidation.data,
          credentialRef: credentialRefValidation.data ?? existing.credentialRef,
        })
      : await connectionRepository.create({ providerId, config: configValidation.data, credentialRef: credentialRefValidation.data });

    await logRepository.create({
      providerId,
      eventType: "connect",
      outcome: "success",
      detail: existing ? `Reconnected ${provider.name}.` : `Connected ${provider.name} for the first time.`,
      actorId: context.actorId,
    });
    await auditLogService.record({
      action: AUDIT_ACTIONS.INTEGRATION_CONNECTED,
      entityType: "Integration",
      entityId: providerId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { providerId, reconnected: !!existing },
    });

    return { success: true, data: toSummary(providerId, connection)! };
  },

  async disconnect(providerId: string, context: AuditContext = {}): Promise<IntegrationResult<IntegrationSummary>> {
    const provider = getProviderDescriptor(providerId);
    if (!provider) return { success: false, error: { code: "not_found", message: `Unknown integration provider "${providerId}".` } };
    if (provider.builtIn) {
      return {
        success: false,
        error: { code: "built_in", message: `${provider.name} is configured via environment variables, not this registry.` },
      };
    }

    const connectionRepository = await getIntegrationConnectionRepository();
    const existing = await connectionRepository.findByProviderId(providerId);
    if (!existing || existing.status === "disconnected") {
      return { success: false, error: { code: "not_connected", message: `${provider.name} is not currently connected.` } };
    }

    const connection = await connectionRepository.update(providerId, { status: "disconnected", enabled: false });

    const logRepository = await getIntegrationLogRepository();
    await logRepository.create({ providerId, eventType: "disconnect", outcome: "success", detail: `Disconnected ${provider.name}.`, actorId: context.actorId });
    await auditLogService.record({
      action: AUDIT_ACTIONS.INTEGRATION_DISCONNECTED,
      entityType: "Integration",
      entityId: providerId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { providerId },
    });

    return { success: true, data: toSummary(providerId, connection)! };
  },

  async setEnabled(providerId: string, enabled: boolean, context: AuditContext = {}): Promise<IntegrationResult<IntegrationSummary>> {
    const provider = getProviderDescriptor(providerId);
    if (!provider) return { success: false, error: { code: "not_found", message: `Unknown integration provider "${providerId}".` } };
    if (provider.builtIn) {
      return {
        success: false,
        error: { code: "built_in", message: `${provider.name} is configured via environment variables, not this registry.` },
      };
    }

    const connectionRepository = await getIntegrationConnectionRepository();
    const existing = await connectionRepository.findByProviderId(providerId);
    if (!existing || existing.status === "disconnected") {
      return { success: false, error: { code: "not_connected", message: `Connect ${provider.name} before enabling or disabling it.` } };
    }

    const connection = await connectionRepository.update(providerId, { enabled });

    const logRepository = await getIntegrationLogRepository();
    await logRepository.create({
      providerId,
      eventType: enabled ? "enable" : "disable",
      outcome: "success",
      detail: `${enabled ? "Enabled" : "Disabled"} ${provider.name}.`,
      actorId: context.actorId,
    });
    await auditLogService.record({
      action: enabled ? AUDIT_ACTIONS.INTEGRATION_ENABLED : AUDIT_ACTIONS.INTEGRATION_DISABLED,
      entityType: "Integration",
      entityId: providerId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { providerId },
    });

    return { success: true, data: toSummary(providerId, connection)! };
  },

  async updateConfig(providerId: string, config: unknown, context: AuditContext = {}): Promise<IntegrationResult<IntegrationSummary>> {
    const provider = getProviderDescriptor(providerId);
    if (!provider) return { success: false, error: { code: "not_found", message: `Unknown integration provider "${providerId}".` } };
    if (provider.builtIn) {
      return {
        success: false,
        error: { code: "built_in", message: `${provider.name} is configured via environment variables, not this registry.` },
      };
    }

    const validation = validateIntegrationConfig(config);
    if (!validation.valid) {
      return { success: false, error: { code: "validation", message: "Invalid config.", errors: validation.errors } };
    }

    const connectionRepository = await getIntegrationConnectionRepository();
    const existing = await connectionRepository.findByProviderId(providerId);
    if (!existing) {
      return { success: false, error: { code: "not_connected", message: `Connect ${provider.name} before configuring it.` } };
    }

    const connection = await connectionRepository.update(providerId, { config: validation.data });

    const logRepository = await getIntegrationLogRepository();
    await logRepository.create({ providerId, eventType: "config_updated", outcome: "success", detail: `Updated configuration for ${provider.name}.`, actorId: context.actorId });
    await auditLogService.record({
      action: AUDIT_ACTIONS.INTEGRATION_CONFIG_UPDATED,
      entityType: "Integration",
      entityId: providerId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { providerId },
    });

    return { success: true, data: toSummary(providerId, connection)! };
  },

  /** Extension point for a future module's real sync/health-check
   *  attempt to report its own outcome — deliberately NOT audit-logged
   *  (routine/automated, potentially high-frequency, the same
   *  threshold that already excludes plain Activity logging and
   *  5.1/5.3's own automation-triggered analysis runs). Only updates
   *  health/lastSuccessAt/lastFailureAt/lastError on the connection and
   *  appends one IntegrationLog row.
   *
   *  Configuration & Integration Verification — a builtIn provider
   *  (email/openai/anthropic/gemini; whatsapp too, unless it has its
   *  own tenant-scoped connection) has no IntegrationConnection row to
   *  update health on (toSummary() derives its status/health from
   *  getBuiltInStatus() instead — see that function's own doc comment),
   *  so the connection-update half below still only applies when a
   *  real row exists. The IntegrationLog write is unconditional now:
   *  a builtIn provider's own "Test Connection" result belongs in its
   *  Logs panel exactly like every other provider's does, and writing
   *  a log row has no such "which record do I update" ambiguity. */
  async recordSync(providerId: string, outcome: IntegrationLogOutcome, detail: string): Promise<void> {
    const provider = getProviderDescriptor(providerId);
    if (!provider) return;

    const logRepository = await getIntegrationLogRepository();
    await logRepository.create({ providerId, eventType: "sync", outcome, detail });

    if (provider.builtIn) return;

    const connectionRepository = await getIntegrationConnectionRepository();
    const existing = await connectionRepository.findByProviderId(providerId);
    if (!existing) return;

    const now = new Date().toISOString();
    await connectionRepository.update(providerId, {
      health: outcome === "success" ? "ok" : "error",
      ...(outcome === "success" ? { lastSuccessAt: now } : { lastFailureAt: now, lastError: detail }),
    });
  },

  async listLogs(providerId: string, page = 1, limit = 20): Promise<PaginatedResult<IntegrationLog>> {
    const repository = await getIntegrationLogRepository();
    return repository.list({ providerId }, page, limit);
  },

  /** Calendar & Meeting Connectors (Phase 6), Module 6.3 — the real
   *  extension point IntegrationCredentialRef's own doc comment
   *  anticipated: a connection whose credential is a rotating OAuth
   *  token pair needs to update *just* credentialRef after a silent,
   *  automated refresh, without disturbing `config` or re-running
   *  connect()'s own "first connection" logging. Deliberately NOT
   *  audit-logged or IntegrationLog-logged, the identical
   *  routine/automated/high-frequency threshold recordSync()'s own doc
   *  comment already applies — an access token can refresh every
   *  request, nowhere near "a deliberate state change a person
   *  initiated." Silently no-ops for an unconnected/unknown/builtIn
   *  provider, the same fail-quiet posture recordSync() already takes,
   *  since a background token refresh has no one to surface an error
   *  to synchronously. */
  async updateCredentialRef(providerId: string, credentialRef: IntegrationCredentialRef): Promise<void> {
    const provider = getProviderDescriptor(providerId);
    if (!provider || provider.builtIn) return;

    const connectionRepository = await getIntegrationConnectionRepository();
    const existing = await connectionRepository.findByProviderId(providerId);
    if (!existing) return;

    await connectionRepository.update(providerId, { credentialRef });
  },

  /**
   * Business OS Phase 8, Module 8.2 — the one write path for a tenant's
   * own per-organization provider credentials (WhatsApp/Email/AI's env
   * fallback, plus Storage/Calendar/Payments/Webhooks/Notifications'
   * generic key-value config), backing the admin credential-connect UI
   * (Task #22) and `credentialResolver.ts` (the read side). Deliberately
   * does NOT reject builtIn providers the way connect()/disconnect()/
   * setEnabled()/updateConfig() above do — those guard the *generic
   * registry connect lifecycle* builtIn providers never had (their real
   * connect lifecycle is env-config, unchanged); a tenant_secret
   * override is a different, additive thing builtIn providers CAN have
   * (that's the whole point of Module 8.2 — see credentialResolver.ts's
   * own doc comment: "resolve tenant credential first, env is always
   * the fallback"). `values` are the plaintext the caller collected
   * from an admin (e.g. `{apiKey: "sk-...", accountId: "123"}`);
   * encrypted here via credentialCrypto.ts before ever reaching a
   * repository call — the plaintext values themselves are never
   * logged, never included in the IntegrationLog `detail` string or the
   * audit metadata below (only the configured KEY NAMES are), and the
   * returned IntegrationSummary has its credentialRef masked by
   * toSummary()/maskCredentialRef() before this ever reaches an API
   * response.
   */
  /**
   * `config` (added for Business OS Phase 8, Module 8.5) is an
   * optional, additive parameter — every pre-existing caller (the
   * generic `PUT /credentials` route, `TenantCredentialsForm`) omits
   * it entirely and behaves byte-for-byte as before. It exists for a
   * real, narrow need: some of what a connection flow discovers
   * (Module 8.5's own `phoneNumberId`/`businessAccountId`) is a plain
   * operational identifier, not a secret — genuinely safe to read back
   * without decryption, unlike `accessToken`. Writing it here, in the
   * SAME call as the encrypted credential, keeps both facts from ever
   * drifting out of sync (no separate call, no separate builtIn-config
   * write path to keep updated in lockstep) — never a substitute for
   * `resolveTenantCredentials()` as the actual trusted read path for a
   * real outbound API call, only for cheap display/routing use.
   */
  async setTenantCredentials(
    providerId: string,
    values: Record<string, string>,
    context: AuditContext = {},
    options?: { config?: Record<string, unknown>; markConnected?: boolean },
  ): Promise<IntegrationResult<IntegrationSummary>> {
    const provider = getProviderDescriptor(providerId);
    if (!provider) return { success: false, error: { code: "not_found", message: `Unknown integration provider "${providerId}".` } };

    const entries = Object.entries(values ?? {});
    if (entries.length === 0 || entries.some(([, v]) => typeof v !== "string" || !v.trim())) {
      return {
        success: false,
        error: { code: "validation", message: "Invalid credentials.", errors: [{ field: "values", message: "Provide a non-empty map of string credential values." }] },
      };
    }

    const credentialRef: IntegrationCredentialRef = { type: "tenant_secret", encryptedValues: encryptCredentialValues(values) };
    const config = options?.config;
    /** Business OS Phase 8, Module 8.5 — `markConnected` deliberately
     *  defaults to false/unset, preserving Module 8.2's own exact
     *  behavior for every pre-8.5 caller (a builtIn provider's
     *  status/enabled never changes here) — only embeddedSignupService
     *  passes `markConnected: true`, and only for `whatsapp`, since that
     *  is the one builtIn provider Module 8.5 gives a REAL per-tenant
     *  connect/disconnect lifecycle to. See toSummary()'s own
     *  `preferTenantStatus` doc comment for how this stays scoped to
     *  whatsapp alone. */
    const shouldMarkConnected = options?.markConnected === true;

    const connectionRepository = await getIntegrationConnectionRepository();
    const logRepository = await getIntegrationLogRepository();
    const existing = await connectionRepository.findByProviderId(providerId);
    const wasAlreadyTenantScoped = existing?.credentialRef.type === "tenant_secret";

    // Note: connectionRepository.create() itself unconditionally sets
    // status:"connected"/enabled:true on first insert (its own
    // long-standing behavior for the non-builtIn connect() lifecycle,
    // unchanged here) — so a FIRST-EVER setTenantCredentials call
    // already gets a "connected" row without needing to ask for it
    // explicitly; `shouldMarkConnected` only matters for the UPDATE
    // path below, where create()'s own default doesn't apply.
    const connection = existing
      ? await connectionRepository.update(providerId, {
          credentialRef,
          ...(config ? { config } : {}),
          ...(!provider.builtIn || shouldMarkConnected ? { status: "connected", enabled: true } : {}),
        })
      : await connectionRepository.create({ providerId, credentialRef, ...(config ? { config } : {}) });

    const keys = entries.map(([key]) => key);
    await logRepository.create({
      providerId,
      eventType: wasAlreadyTenantScoped ? "config_updated" : "connect",
      outcome: "success",
      detail: `${wasAlreadyTenantScoped ? "Updated" : "Configured"} tenant credentials for ${provider.name}. Keys: ${keys.join(", ")}.`,
      actorId: context.actorId,
    });
    await auditLogService.record({
      action: wasAlreadyTenantScoped ? AUDIT_ACTIONS.INTEGRATION_CREDENTIALS_UPDATED : AUDIT_ACTIONS.INTEGRATION_CREDENTIALS_CONFIGURED,
      entityType: "Integration",
      entityId: providerId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { providerId, keys },
    });

    return { success: true, data: toSummary(providerId, connection)! };
  },

  /** The removal side of setTenantCredentials() — resets credentialRef
   *  back to DEFAULT_CREDENTIAL_REF, which for a builtIn provider means
   *  the resolver naturally falls through to env config again on the
   *  very next call (no separate "revert" logic needed), and for a
   *  registry provider means the connection has no usable credential
   *  until reconnected. Only meaningful for a connection that's
   *  currently tenant_secret; a no-op is reported as `not_connected`
   *  rather than silently succeeding, so an admin never gets a false
   *  "removed" confirmation for something that was never tenant-scoped
   *  in the first place. */
  async clearTenantCredentials(providerId: string, context: AuditContext = {}): Promise<IntegrationResult<IntegrationSummary>> {
    const provider = getProviderDescriptor(providerId);
    if (!provider) return { success: false, error: { code: "not_found", message: `Unknown integration provider "${providerId}".` } };

    const connectionRepository = await getIntegrationConnectionRepository();
    const existing = await connectionRepository.findByProviderId(providerId);
    if (!existing || existing.credentialRef.type !== "tenant_secret") {
      return { success: false, error: { code: "not_connected", message: `${provider.name} has no tenant credentials configured.` } };
    }

    const connection = await connectionRepository.update(providerId, {
      credentialRef: DEFAULT_CREDENTIAL_REF,
      ...(provider.builtIn ? {} : { status: "disconnected", enabled: false }),
    });

    const logRepository = await getIntegrationLogRepository();
    await logRepository.create({ providerId, eventType: "config_updated", outcome: "success", detail: `Removed tenant credentials for ${provider.name}.`, actorId: context.actorId });
    await auditLogService.record({
      action: AUDIT_ACTIONS.INTEGRATION_CREDENTIALS_REMOVED,
      entityType: "Integration",
      entityId: providerId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { providerId },
    });

    return { success: true, data: toSummary(providerId, connection)! };
  },
};
