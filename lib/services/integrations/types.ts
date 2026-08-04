import type { PaginatedResult } from "@/lib/pagination";

/**
 * Integrations Hub (Phase 6), Module 6.1 — Generic Integrations Registry.
 *
 * This is the architecture layer, not a rebuild of any existing
 * integration. WhatsApp (Phase 2), Email (Phase 4), and AI (Phase 5)
 * each already have their own working provider-registry seam
 * (lib/services/whatsapp/registry.ts, lib/services/email/registry.ts,
 * lib/services/ai/registry.ts) selected via env config
 * (config/whatsapp.ts, config/emailChannel.ts, config/aiInsights.ts).
 * None of that is touched, duplicated, or migrated here — this module
 * adds one more layer *above* those three (and a static catalog of
 * providers with no code yet — Storage/Calendar/Payments/
 * Notifications/generic Webhooks, all explicitly Post-6.1) so an admin
 * has one place to see connection/health/sync state across every
 * integration, present or future, without the CRM's own business logic
 * ever needing to know which concrete vendor is behind any of them.
 */

export type IntegrationCategory = "communication" | "ai" | "storage" | "calendar" | "payments" | "notifications" | "other";

export type IntegrationCapability =
  | "send_message"
  | "receive_message"
  | "generate_text"
  | "store_file"
  | "schedule_meeting"
  | "process_payment"
  | "send_notification"
  | "receive_webhook";

/**
 * A provider's static, code-defined metadata — id, display name,
 * category, capabilities, and whether it's already implemented
 * elsewhere in the app ("builtIn") or a placeholder for a future
 * module to actually wire up. This is the "Provider Registry" +
 * "Capability Discovery" + "Provider Metadata" requirements: a plain
 * array a future module appends to, never a giant switch statement
 * scattered across CRM code that needs editing per provider.
 */
export interface IntegrationProviderDescriptor {
  id: string;
  name: string;
  category: IntegrationCategory;
  capabilities: IntegrationCapability[];
  /** True for WhatsApp/Email/AI — already implemented in an earlier
   *  phase, with their own env-driven config and provider registry.
   *  This module reads their *live status* read-only (see
   *  builtInStatus.ts) rather than tracking it as a second source of
   *  truth in IntegrationConnection. */
  builtIn: boolean;
  /** Which future module is expected to implement this provider for
   *  real, per the approved blueprint — purely descriptive, shown in
   *  the admin UI so "Connect" on an unbuilt provider sets honest
   *  expectations rather than implying real functionality exists. */
  plannedModule?: string;
  description: string;
}

export type IntegrationConnectionStatus = "connected" | "disconnected";
export type IntegrationHealthStatus = "unknown" | "ok" | "error";

/**
 * Never the secret itself — a pointer to where the real credential
 * lives. `"env"` covers every integration this app has today (a real
 * value lives in an environment variable, per config/*.ts); `"none"`
 * is a provider that needs no credential (e.g. a purely receive-only
 * webhook); `"vault"` is the extension point for whichever later
 * module actually adds per-tenant secret storage — this type exists so
 * that future module only needs to add a new discriminant case, not
 * change IntegrationConnection's own shape.
 *
 * `"oauth"` (Module 6.3) is exactly that extension point being used for
 * real: a completed 3-legged OAuth grant (Google/Microsoft/Zoom) has no
 * single static "env" credential to point at — the access/refresh
 * tokens are themselves the secret, minted per-connection at OAuth
 * callback time. Rather than inventing a real external vault (out of
 * scope for this module — no KMS/Vault/Secrets-Manager integration
 * exists anywhere in this app), the token strings are AES-256-GCM
 * encrypted at rest (lib/services/calendar/tokenCrypto.ts) before ever
 * reaching this field — `accessToken`/`refreshToken` below are always
 * ciphertext, never plaintext, so `IntegrationConnection.credentialRef`
 * still holds no raw secret, the same invariant "env"/"vault" already
 * upheld. `validateCredentialRef()` (validation.ts) accepts this shape
 * from the OAuth callback route only — never from a client-supplied
 * connect/config request body, since a client could otherwise inject an
 * arbitrary "already-encrypted-looking" string as a token.
 *
 * `"webhook_url"` (Module 6.5) — Slack/Microsoft Teams/Discord's real,
 * documented "post a message into one known channel" mechanism is a
 * bare Incoming Webhook URL, not an OAuth grant: no token to refresh,
 * no scope, no expiry, just one opaque secret URL. Forcing that into
 * the "oauth" shape above would mean fabricating a refreshToken/
 * expiresAt/scope that don't exist for these providers — a different,
 * simpler shape was the honest choice. `encryptedUrl` is AES-256-GCM
 * ciphertext (lib/services/webhooks/secretCrypto.ts), the same "never
 * a raw secret in a normal DB field" invariant every other variant
 * here already upholds.
 */
export type IntegrationCredentialRef =
  | { type: "env"; description: string }
  | { type: "vault"; ref: string }
  | { type: "none" }
  | { type: "oauth"; provider: string; accessToken: string; refreshToken?: string; expiresAt: string; scope?: string }
  | { type: "webhook_url"; encryptedUrl: string }
  | { type: "tenant_secret"; encryptedValues: Record<string, string> };

/**
 * Business OS Phase 8, Module 8.2 — Tenant Context & Credentials.
 * `"tenant_secret"` is the real per-organization credential storage the
 * "vault" discriminant's own doc comment above named as a future
 * extension point — added as a NEW discriminant rather than repurposing
 * `"vault"` itself, the same precedent `"oauth"` (6.3) and
 * `"webhook_url"` (6.5) each already set (a real external
 * KMS/Vault/Secrets-Manager integration, which this app still has none
 * of, is what `"vault"` was always meant to describe — `"tenant_secret"`
 * is this app's own encryption-at-rest answer instead, the same
 * AES-256-GCM shape `"oauth"`/`"webhook_url"` already use).
 * `encryptedValues` holds provider-agnostic generic credential-field
 * names ("apiKey"/"apiSecret"/"accessToken"/"refreshToken"/
 * "webhookSecret"/"accountId"/"phoneNumberId"/"businessAccountId"/etc.
 * — whatever a given provider's own resolver call expects) mapped to
 * AES-256-GCM ciphertext (lib/services/integrations/credentialCrypto.ts)
 * — never plaintext, the same "no raw secret in a normal DB field"
 * invariant every other variant here already upholds.
 * `credentialResolver.ts` is the only reader; `validateCredentialRef()`
 * accepts this shape only from the trusted server-side credential-set
 * route, never a client-supplied "already-encrypted-looking" value —
 * the same guard `"oauth"` already established.
 */

/**
 * One row per (organizationId, providerId) — the registry's own
 * persisted lifecycle state for a provider a human has explicitly
 * connected/configured. Deliberately holds no raw secret value in any
 * field — `config` is validated to reject the small set of key names
 * that look credential-shaped (see validation.ts), and real secrets
 * belong in env vars (`credentialRef.type === "env"`) until a later
 * module adds real per-tenant secret storage.
 */
export interface IntegrationConnection {
  id: string;
  providerId: string;
  status: IntegrationConnectionStatus;
  enabled: boolean;
  /** Non-secret settings only (display preferences, chosen sub-options,
   *  non-sensitive identifiers) — validated at the service boundary. */
  config: Record<string, unknown>;
  credentialRef: IntegrationCredentialRef;
  health: IntegrationHealthStatus;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 8). Same convention as every other collection in
   *  this app (Lead.organizationId, Conversation.organizationId, etc.)
   *  — deliberately not populated yet, since nothing else in the
   *  codebase populates its own organizationId either; Module 6.1 isn't
   *  the place to become the first mover on real tenant scoping. */
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationConnectionInput {
  providerId: string;
  config?: Record<string, unknown>;
  credentialRef?: IntegrationCredentialRef;
  organizationId?: string;
}

export interface UpdateIntegrationConnectionInput {
  status?: IntegrationConnectionStatus;
  enabled?: boolean;
  config?: Record<string, unknown>;
  credentialRef?: IntegrationCredentialRef;
  health?: IntegrationHealthStatus;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
}

export interface IntegrationConnectionRepository {
  findByProviderId(providerId: string): Promise<IntegrationConnection | null>;
  list(): Promise<IntegrationConnection[]>;
  create(input: CreateIntegrationConnectionInput): Promise<IntegrationConnection>;
  /** Covers every lifecycle transition after creation — disconnect,
   *  enable/disable, reconnect, config update, health/sync recording —
   *  never a hard delete: "Reconnect State" and "Integration Logs"
   *  both imply the row and its history persist across a disconnect. */
  update(providerId: string, input: UpdateIntegrationConnectionInput): Promise<IntegrationConnection>;
}

export type IntegrationLogEventType = "connect" | "disconnect" | "enable" | "disable" | "config_updated" | "sync" | "health_check";
export type IntegrationLogOutcome = "success" | "failure";

/** Append-only — "Integration Logs" / "Sync Logs" requirement. Same
 *  shape as WebhookDelivery (Module 2.4): one row per event, never
 *  updated after creation, `detail` a short human-readable string —
 *  never a raw config/credential dump (see integrationService.ts's own
 *  doc comment on why). */
export interface IntegrationLog {
  id: string;
  providerId: string;
  eventType: IntegrationLogEventType;
  outcome: IntegrationLogOutcome;
  detail: string;
  actorId?: string;
  organizationId?: string;
  createdAt: string;
}

export interface CreateIntegrationLogInput {
  providerId: string;
  eventType: IntegrationLogEventType;
  outcome: IntegrationLogOutcome;
  detail: string;
  actorId?: string;
  organizationId?: string;
}

export interface IntegrationLogListFilters {
  providerId: string;
}

export interface IntegrationLogRepository {
  create(input: CreateIntegrationLogInput): Promise<IntegrationLog>;
  list(filters: IntegrationLogListFilters, page: number, limit: number): Promise<PaginatedResult<IntegrationLog>>;
}

/** The merged, read-model view the admin UI and the list API actually
 *  consume — provider metadata + persisted connection state (or a
 *  sensible "never connected" default) + built-in live status folded
 *  into the same shape, so the UI never needs to branch on "is this a
 *  builtIn provider or a registry-tracked one." */
export interface IntegrationSummary {
  provider: IntegrationProviderDescriptor;
  status: IntegrationConnectionStatus;
  enabled: boolean;
  health: IntegrationHealthStatus;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  config: Record<string, unknown>;
  credentialRef: IntegrationCredentialRef;
}
