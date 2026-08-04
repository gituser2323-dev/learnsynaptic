"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Info, Loader2, Plus, X, ChevronDown, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import {
  getSettings,
  listTags,
  createTag,
  deleteTag,
  listCustomFieldDefinitions,
  createCustomFieldDefinition,
  deleteCustomFieldDefinition,
  getActiveAssignmentRule,
  setAssignmentRule,
  listStaff,
  listWebhookDeliveries,
  getWhatsAppPhoneHealth,
  listIntegrations,
  connectIntegration,
  disconnectIntegration,
  setIntegrationEnabled,
  updateIntegrationConfig,
  listIntegrationLogs,
  calendarOAuthAuthorizePath,
  syncCalendarProvider,
  registerWebhookEndpoint,
  listWebhookEndpoints,
  updateWebhookEndpoint,
  setWebhookEndpointEnabled,
  deleteWebhookEndpoint,
  rotateWebhookSecret,
  testWebhookEndpoint,
  listOutboundWebhookDeliveries,
  replayWebhookDelivery,
  connectNotificationWebhookUrl,
  testNotification,
  setIntegrationCredentials,
  clearIntegrationCredentials,
  getSubscription,
  getBillingUsage,
  listPlans,
  assignPlan,
  cancelSubscription,
  getBrandConfiguration,
  updateBrandConfiguration,
  resetBrandConfiguration,
  uploadFile,
  getWhatsAppEmbeddedSignupConfig,
  getWhatsAppConnectionStatus,
  completeWhatsAppEmbeddedSignup,
  disconnectWhatsAppEmbeddedSignup,
} from "@/components/admin/apiClient";
import type { WhatsAppConnectionSummary } from "@/components/admin/apiClient";
import { useAdminBranding } from "@/components/admin/AdminBrandingContext";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import {
  Badge,
  webhookDeliveryOutcomeTone,
  qualityRatingTone,
  integrationStatusTone,
  integrationHealthTone,
  webhookEndpointStatusTone,
  outboundWebhookDeliveryOutcomeTone,
} from "@/components/admin/Badge";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { Skeleton } from "@/components/admin/Skeleton";
import { FormField } from "@/components/admin/FormField";
import { FilterSelect } from "@/components/admin/FilterControls";
import { Pagination } from "@/components/admin/Pagination";
import type { AdminSettingsSnapshot } from "@/lib/services/settings";
import type { CustomFieldType } from "@/lib/services/crm/customFields";
import type { AssignmentStrategy } from "@/lib/services/crm/assignment";
import type { WebhookDeliveryOutcome } from "@/lib/services/webhookMonitoring";
import type { IntegrationCategory, IntegrationSummary } from "@/lib/services/integrations";
import type { CalendarProviderId } from "@/lib/services/calendar";
import type { WebhookEndpoint, WebhookDeliveryOutcome as OutboundWebhookDeliveryOutcome, NotificationProviderId } from "@/lib/services/webhooks";

/** Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 *  full catalogue of event types anything in this app currently
 *  publishes, offered as convenient checkboxes on the registration
 *  form. Deliberately NOT the only way to subscribe — the free-text
 *  field beside it lets an admin subscribe to an event type this list
 *  hasn't caught up with yet, matching the event bus's own "future
 *  modules publish new events without modifying core architecture"
 *  design (see eventBus.ts's wildcard support). The three payment.*
 *  types are listed as reserved: named in this module's own mission,
 *  catalogued here for forward-compatibility, but nothing publishes
 *  them yet since Module 6.4 (Payments) doesn't exist. */
const CATALOGUED_EVENT_TYPES = [
  "lead.created",
  "lead.updated",
  "lead.assigned",
  "lead.converted",
  "registration.created",
  "task.created",
  "task.completed",
  "task.overdue",
  "opportunity.stage_changed",
  "opportunity.won",
  "opportunity.lost",
  "message.received",
  "whatsapp.message.sent",
  "whatsapp.message.delivered",
  "whatsapp.message.read",
  "whatsapp.message.failed",
  "workflow.started",
  "workflow.completed",
  "workflow.failed",
];
const RESERVED_EVENT_TYPES = ["payment.success", "payment.failed", "payment.refund"];
const ALL_EVENTS_WILDCARD = "*";
const OUTBOUND_DELIVERY_OUTCOMES: OutboundWebhookDeliveryOutcome[] = ["pending", "delivered", "failed", "dead_letter"];

const WEBHOOK_OUTCOMES: WebhookDeliveryOutcome[] = ["processed", "unrecognized", "signature_invalid"];

const INTEGRATION_CATEGORIES: IntegrationCategory[] = ["communication", "ai", "storage", "calendar", "payments", "notifications", "other"];
const INTEGRATION_CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  communication: "Communication",
  ai: "AI",
  storage: "Storage",
  calendar: "Calendar / Meetings",
  payments: "Payments",
  notifications: "Notifications",
  other: "Other",
};

const CUSTOM_FIELD_TYPES: CustomFieldType[] = ["text", "number", "date", "dropdown", "checkbox", "radio", "multiselect"];
const OPTIONS_FIELD_TYPES: CustomFieldType[] = ["dropdown", "radio", "multiselect"];

function ConfiguredBadge({ configured }: { configured: boolean }) {
  return <Badge tone={configured ? "success" : "neutral"}>{configured ? "Configured" : "Not configured"}</Badge>;
}

function SettingsRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--adm-border)" }}>
      <span className="text-sm" style={{ color: "var(--adm-text-secondary)" }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>
        {value}
      </span>
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--adm-border)", background: "var(--adm-surface)" }}>
      <h2 className="!text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
        {title}
      </h2>
      <div>{children}</div>
    </div>
  );
}

function SettingsCardSkeleton() {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--adm-border)", background: "var(--adm-surface)" }}>
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}

/**
 * Module 2.3 — Business Account Health. The blueprint's own spec for
 * this card: "Settings — WhatsApp Provider panel gains live status."
 * Populated only by the scheduled whatsapp.phone_health_check job —
 * this card just displays whatever the most recent cycle found, never
 * calls the vendor itself. Empty (no rows yet) is a normal state, not
 * an error: no real vendor credentials means the job has nothing to
 * report, the same "not configured" posture the rest of this card
 * already takes for unconfigured vendors.
 */
function WhatsAppPhoneHealthRows() {
  const { data, loading } = useAdminData(() => getWhatsAppPhoneHealth(), []);
  if (loading || !data || data.phoneNumbers.length === 0) return null;

  return (
    <>
      {data.phoneNumbers.map((phone) => (
        <div key={phone.id}>
          <SettingsRow
            label={phone.displayPhoneNumber ?? phone.phoneNumberId}
            value={<Badge tone={qualityRatingTone(phone.qualityRating)}>{phone.qualityRating}</Badge>}
          />
          {phone.messagingLimit && <SettingsRow label="Messaging limit" value={phone.messagingLimit} />}
          <SettingsRow label="Last checked" value={new Date(phone.lastCheckedAt).toLocaleString()} />
        </div>
      ))}
    </>
  );
}

function renderSnapshot(settings: AdminSettingsSnapshot) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <SettingsCard title="WhatsApp Provider">
        <SettingsRow label="Active provider" value={settings.whatsapp.activeProvider} />
        <SettingsRow label="Meta Cloud API" value={<ConfiguredBadge configured={settings.whatsapp.providersConfigured.metaCloudApi} />} />
        <SettingsRow label="AiSensy" value={<ConfiguredBadge configured={settings.whatsapp.providersConfigured.aisensy} />} />
        <SettingsRow label="Interakt" value={<ConfiguredBadge configured={settings.whatsapp.providersConfigured.interakt} />} />
        <SettingsRow label="WATI" value={<ConfiguredBadge configured={settings.whatsapp.providersConfigured.wati} />} />
        <SettingsRow label="Gallabox" value={<ConfiguredBadge configured={settings.whatsapp.providersConfigured.gallabox} />} />
        <WhatsAppPhoneHealthRows />
      </SettingsCard>

      <SettingsCard title="Campaign Manager">
        <SettingsRow label="CSV import row cap" value={settings.campaigns.csvImportMaxRows.toLocaleString()} />
        <SettingsRow label="Retry max attempts" value={settings.campaigns.retryPolicy.maxAttempts} />
        <SettingsRow
          label="Retry backoff"
          value={settings.campaigns.retryPolicy.backoffMinutes.map((m) => `${m}m`).join(" → ")}
        />
      </SettingsCard>

      <SettingsCard title="Marketing">
        <SettingsRow label="Ads provider" value={settings.marketing.adsProvider} />
        <SettingsRow label="Ads credentials" value={<ConfiguredBadge configured={settings.marketing.adsConfigured} />} />
        <SettingsRow label="Web analytics provider" value={settings.marketing.webAnalyticsProvider} />
        <SettingsRow
          label="Web analytics credentials"
          value={<ConfiguredBadge configured={settings.marketing.webAnalyticsConfigured} />}
        />
      </SettingsCard>

      <SettingsCard title="Database">
        <SettingsRow label="MongoDB" value={<ConfiguredBadge configured={settings.database.mongodbConfigured} />} />
        {!settings.database.mongodbConfigured && (
          <p className="mt-2 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
            Running on in-memory dev repositories — data does not persist across restarts.
          </p>
        )}
      </SettingsCard>

      <SettingsCard title="Audit Log">
        <SettingsRow label="Retention period" value={`${settings.auditLog.retentionDays} days`} />
      </SettingsCard>

      <SettingsCard title="Authentication">
        <SettingsRow label="JWT signing secret" value={<ConfiguredBadge configured={settings.auth.jwtSecretConfigured} />} />
        <SettingsRow label="Access token TTL" value={`${Math.round(settings.auth.accessTokenTtlSeconds / 60)}m`} />
        <SettingsRow label="Refresh token TTL" value={`${Math.round(settings.auth.refreshTokenTtlSeconds / 86400)}d`} />
      </SettingsCard>
    </div>
  );
}

/**
 * Enterprise CRM (Phase 1) — Tags/Custom Fields/Assignment Rules are the
 * only Settings entries that are actually mutable (everything above
 * this point stays environment-sourced/read-only, per the page's
 * existing "change it by updating the deployment" copy — this section
 * is deliberately introduced with its own heading so that distinction
 * stays visible rather than blurred into one grid).
 */
function TagsPanel() {
  const { data, loading, reload } = useAdminData(() => listTags(), []);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#2d4fd6");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    const result = await createTag(label.trim(), color);
    setSubmitting(false);
    if (result.success) {
      setLabel("");
      reload();
    }
  }

  return (
    <SettingsCard title="Lead Tags">
      <div className="mt-3 flex flex-wrap gap-2">
        {loading && <Skeleton className="h-6 w-24" />}
        {!loading && data?.tags.length === 0 && (
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            No tags yet.
          </p>
        )}
        {!loading &&
          data?.tags.map((tag) => (
            <span
              key={tag.id}
              className="adm-chip"
              style={{ background: `${tag.color}22`, color: tag.color, borderColor: "transparent" }}
            >
              {tag.label}
              <button
                type="button"
                aria-label={`Delete tag ${tag.label}`}
                onClick={() => deleteTag(tag.id).then(reload)}
                className="adm-focus-ring ml-1"
              >
                <X size={11} />
              </button>
            </span>
          ))}
      </div>
      <form onSubmit={handleCreate} className="mt-4 flex items-end gap-2">
        <FormField id="new-tag-label" label="New tag" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Hot lead" className="flex-1" />
        <div>
          <label htmlFor="new-tag-color" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            Color
          </label>
          <input id="new-tag-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="adm-focus-ring h-9 w-12 rounded-[var(--adm-radius-sm)]" />
        </div>
        <button type="submit" disabled={submitting || !label.trim()} className="adm-focus-ring adm-btn adm-btn-secondary">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        </button>
      </form>
    </SettingsCard>
  );
}

function CustomFieldsPanel() {
  const { data, loading, reload } = useAdminData(() => listCustomFieldDefinitions(), []);
  const [key, setKey] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");
  const [required, setRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!key.trim() || !fieldLabel.trim()) return;
    setSubmitting(true);
    const result = await createCustomFieldDefinition({
      key: key.trim(),
      label: fieldLabel.trim(),
      fieldType,
      required,
      options: OPTIONS_FIELD_TYPES.includes(fieldType)
        ? options.split(",").map((o) => o.trim()).filter(Boolean)
        : undefined,
    });
    setSubmitting(false);
    if (result.success) {
      setKey("");
      setFieldLabel("");
      setOptions("");
      setRequired(false);
      reload();
    }
  }

  return (
    <SettingsCard title="Custom Fields">
      <div className="mt-3 space-y-1.5">
        {loading && <Skeleton className="h-4 w-full" />}
        {!loading && data?.definitions.length === 0 && (
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            No custom fields defined.
          </p>
        )}
        {!loading &&
          data?.definitions.map((def) => (
            <div key={def.id} className="flex items-center justify-between gap-2 border-t py-2 first:border-t-0" style={{ borderColor: "var(--adm-border)" }}>
              <div>
                <p className="text-sm" style={{ color: "var(--adm-text)" }}>
                  {def.label} <span style={{ color: "var(--adm-text-muted)" }}>({def.key})</span>
                </p>
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {def.fieldType}
                  {def.required && " · required"}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Delete field ${def.label}`}
                onClick={() => deleteCustomFieldDefinition(def.id).then(reload)}
                className="adm-focus-ring adm-icon-btn"
              >
                <X size={13} />
              </button>
            </div>
          ))}
      </div>
      <form onSubmit={handleCreate} className="mt-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <FormField id="new-field-key" label="Key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="preferred_batch" />
          <FormField id="new-field-label" label="Label" value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="Preferred Batch" />
        </div>
        <FilterSelect label="Field type" value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldType)} className="w-full">
          {CUSTOM_FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </FilterSelect>
        {OPTIONS_FIELD_TYPES.includes(fieldType) && (
          <FormField id="new-field-options" label="Options (comma-separated)" value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Morning, Evening, Weekend" />
        )}
        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="adm-focus-ring" />
          Required
        </label>
        <button type="submit" disabled={submitting || !key.trim() || !fieldLabel.trim()} className="adm-focus-ring adm-btn adm-btn-secondary w-full">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Add field
        </button>
      </form>
    </SettingsCard>
  );
}

function AssignmentRulePanel() {
  const { data, loading, reload } = useAdminData(() => getActiveAssignmentRule(), []);
  const { data: staff } = useAdminData(() => listStaff(), []);
  const [strategy, setStrategy] = useState<AssignmentStrategy>("manual");
  const [counsellorIds, setCounsellorIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !initialized && data) {
    setInitialized(true);
    setStrategy(data.rule?.strategy ?? "manual");
    setCounsellorIds(new Set(data.rule?.counsellorIds ?? []));
  }

  function toggleCounsellor(id: string) {
    setCounsellorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSubmitting(true);
    const result = await setAssignmentRule(strategy, Array.from(counsellorIds));
    setSubmitting(false);
    if (result.success) reload();
  }

  return (
    <SettingsCard title="Lead Assignment">
      <div className="mt-3 space-y-3">
        <FilterSelect label="Assignment strategy" value={strategy} onChange={(e) => setStrategy(e.target.value as AssignmentStrategy)} className="w-full">
          <option value="manual">Manual</option>
          <option value="round_robin">Round robin</option>
        </FilterSelect>
        {strategy === "round_robin" && (
          <div>
            <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
              Eligible counsellors
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {staff?.users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm" style={{ color: "var(--adm-text)" }}>
                  <input type="checkbox" checked={counsellorIds.has(u.id)} onChange={() => toggleCounsellor(u.id)} className="adm-focus-ring" />
                  {u.name || u.email}
                </label>
              ))}
            </div>
          </div>
        )}
        <button type="button" onClick={handleSave} disabled={submitting} className="adm-focus-ring adm-btn adm-btn-primary w-full">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Save assignment rule
        </button>
      </div>
    </SettingsCard>
  );
}

/**
 * Business OS Phase 8, Module 8.2 — the builtIn providers whose adapter
 * actually calls credentialResolver.ts today (see
 * lib/services/ai/providers/*.ts, lib/services/email/providers/
 * postmark.provider.ts, lib/services/whatsapp/providers/
 * metaCloudApi.provider.ts) — the ONLY providers this form is offered
 * for. Deliberately not extended to Storage/Calendar/Payments/Webhooks
 * yet: those provider adapters don't resolve a tenant credential yet
 * (a disclosed, lighter-depth pass — see CHANGELOG.md), so a form that
 * appeared to "connect" them here would silently store a credential no
 * code ever reads, a worse outcome than not offering the form at all.
 * Field keys must exactly match what each adapter passes to
 * resolveTenantCredential(s) — see this module's own CHANGELOG entry
 * for the full mapping.
 */
const TENANT_CREDENTIAL_FIELDS: Record<string, { key: string; label: string }[]> = {
  whatsapp: [
    { key: "accessToken", label: "Access Token" },
    { key: "phoneNumberId", label: "Phone Number ID" },
    { key: "businessAccountId", label: "Business Account ID (optional)" },
  ],
  email: [
    { key: "serverToken", label: "Postmark Server Token" },
    { key: "fromAddress", label: "From Address" },
  ],
  openai: [{ key: "apiKey", label: "API Key" }],
  anthropic: [{ key: "apiKey", label: "API Key" }],
  gemini: [{ key: "apiKey", label: "API Key" }],
};

/** BuiltIn-provider credential form — a real key-value form (not a raw
 *  JSON textarea, unlike the non-builtIn "Configure" section below),
 *  since these fields are specific and named, not free-form. Values
 *  are write-only: the server never returns a real value back (see
 *  integrationService.maskCredentialRef()), so this form always starts
 *  blank and submits the FULL field set on save — the same "replace,
 *  not merge" semantics updateIntegrationConfig() already has for
 *  non-builtIn providers' config. */
function TenantCredentialsForm({ integration, onChanged }: { integration: IntegrationSummary; onChanged: () => void }) {
  const fields = TENANT_CREDENTIAL_FIELDS[integration.provider.id];
  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!fields) return null;

  const isConfigured = integration.credentialRef.type === "tenant_secret";

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const filled = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim().length > 0));
    if (Object.keys(filled).length === 0) {
      setError("Enter at least one value.");
      return;
    }
    setBusy(true);
    const result = await setIntegrationCredentials(integration.provider.id, filled);
    setBusy(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not save credentials.");
      return;
    }
    setValues({});
    setShowForm(false);
    onChanged();
  }

  async function handleRemove() {
    setBusy(true);
    await clearIntegrationCredentials(integration.provider.id);
    setBusy(false);
    onChanged();
  }

  return (
    <div className="space-y-1.5 border-t pt-2.5" style={{ borderColor: "var(--adm-border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
          Your organization&apos;s credentials{" "}
          {isConfigured ? (
            <span style={{ color: "var(--adm-success)" }}>(configured — overrides environment config)</span>
          ) : (
            <span style={{ color: "var(--adm-text-muted)" }}>(none — using environment config)</span>
          )}
        </p>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setShowForm((v) => !v)} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
            {isConfigured ? "Update" : "Configure"}
          </button>
          {isConfigured && (
            <button type="button" onClick={handleRemove} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
              Remove
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="space-y-1.5">
          {fields.map((field) => (
            <FormField
              key={field.key}
              id={`tenant-cred-${integration.provider.id}-${field.key}`}
              label={field.label}
              type="password"
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder="••••••••"
              className="w-full"
            />
          ))}
          <p className="text-[11px]" style={{ color: "var(--adm-text-muted)" }}>
            Saved values are encrypted and never shown again — leave a field blank only if you mean to save without it. Saving replaces all
            fields for this provider.
          </p>
          {error && (
            <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
            {busy && <Loader2 size={12} className="animate-spin" />}
            Save
          </button>
        </form>
      )}
    </div>
  );
}

const WHATSAPP_CONNECTION_STATE_LABEL: Record<WhatsAppConnectionSummary["state"], string> = {
  not_connected: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  healthy: "Healthy",
  action_required: "Action required",
  token_expired: "Token expired — reauthorize",
  webhook_error: "Webhook error",
  phone_verification_required: "Phone verification required",
  disconnected: "Disconnected",
};

function whatsappConnectionStateTone(state: WhatsAppConnectionSummary["state"]): "neutral" | "info" | "success" | "warning" | "danger" {
  if (state === "healthy") return "success";
  if (state === "connected" || state === "connecting") return "info";
  if (state === "action_required" || state === "phone_verification_required") return "warning";
  if (state === "token_expired" || state === "webhook_error") return "danger";
  return "neutral";
}

/**
 * Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup. Extends
 * the existing WhatsApp IntegrationCard with real tenant self-service
 * onboarding via Meta's official Facebook Login for Business popup —
 * never a redesign of the admin panel, additive to the exact same card
 * every other provider already renders inside. Loads the real Facebook
 * JS SDK (already whitelisted in this app's own CSP — see
 * next.config.ts's connect-src/script-src for connect.facebook.net/
 * graph.facebook.com) only once per page, guarded against StrictMode's
 * double-effect and a second card instance ever re-injecting it.
 *
 * The popup's own two independent signals are reconciled here exactly
 * as Meta's own documented flow requires: `FB.login`'s callback returns
 * the authorization `code`; a separate `window.message` event (fired
 * BY the popup, listened for globally) reports which WABA/phone number
 * the business selected or created inside it. Both are required before
 * this component POSTs to the server-side completion route — the
 * server itself re-verifies the wabaId/phoneNumberId against Meta
 * directly (embeddedSignupService.connect's own doc comment), so this
 * client-side capture is a UX convenience, never a trust boundary.
 */
let fbSdkLoadStarted = false;

function WhatsAppEmbeddedSignupPanel({ onChanged }: { onChanged: () => void }) {
  const [config, setConfig] = useState<{ configured: boolean; entitled: boolean; appId?: string; configId?: string } | null>(null);
  const [connection, setConnection] = useState<WhatsAppConnectionSummary | null>(null);
  const [sdkReady, setSdkReady] = useState(() => typeof window !== "undefined" && Boolean((window as unknown as { FB?: unknown }).FB));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionInfoRef = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [configResult, statusResult] = await Promise.all([getWhatsAppEmbeddedSignupConfig(), getWhatsAppConnectionStatus()]);
      if (cancelled) return;
      if (configResult.success) setConfig(configResult.data);
      if (statusResult.success) setConnection(statusResult.data.connection);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config?.configured || !config.appId) return;
    const w = window as unknown as { FB?: { init: (opts: Record<string, unknown>) => void }; fbAsyncInit?: () => void };
    if (w.FB) return; // already loaded — sdkReady's own initializer already reflects this
    w.fbAsyncInit = () => {
      w.FB?.init({ appId: config.appId, autoLogAppEvents: true, xfbml: false, version: "v21.0" });
      setSdkReady(true);
    };
    if (fbSdkLoadStarted) return;
    fbSdkLoadStarted = true;
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [config]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      let data: { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string } };
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (data.event === "FINISH" && data.data) {
        sessionInfoRef.current = { wabaId: data.data.waba_id, phoneNumberId: data.data.phone_number_id };
      } else if (data.event === "CANCEL") {
        setError("Signup was cancelled.");
      } else if (data.event === "ERROR") {
        setError("Meta reported an error during signup.");
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function handleConnect() {
    setError(null);
    sessionInfoRef.current = {};
    const w = window as unknown as {
      FB?: { login: (cb: (response: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void };
    };
    if (!w.FB || !config?.configId) return;

    w.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setError("WhatsApp signup was not completed.");
          return;
        }
        setBusy(true);
        completeWhatsAppEmbeddedSignup({ code, ...sessionInfoRef.current })
          .then((result) => {
            if (!result.success) {
              setError(result.errors[0]?.message ?? "Could not complete the WhatsApp connection.");
              return;
            }
            setConnection(result.data.connection);
            onChanged();
          })
          .finally(() => setBusy(false));
      },
      { config_id: config.configId, response_type: "code", override_default_response_type: true, extras: { setup: {}, featureType: "", sessionInfoVersion: "3" } },
    );
  }

  async function handleDisconnect() {
    setBusy(true);
    setError(null);
    const result = await disconnectWhatsAppEmbeddedSignup();
    setBusy(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not disconnect.");
      return;
    }
    setConnection(result.data.connection);
    onChanged();
  }

  if (!config) return null;

  if (!config.entitled) {
    return (
      <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
        Self-service WhatsApp connection isn&apos;t included in your current plan.
      </p>
    );
  }

  if (!config.configured) {
    return (
      <p className="text-xs italic" style={{ color: "var(--adm-text-muted)" }}>
        WhatsApp Embedded Signup isn&apos;t configured on this deployment yet — contact your platform administrator.
      </p>
    );
  }

  const isConnected = connection && connection.state !== "not_connected" && connection.state !== "disconnected";

  return (
    <div className="space-y-1.5 border-t pt-2.5" style={{ borderColor: "var(--adm-border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            Your organization&apos;s WhatsApp Business Account
          </p>
          {connection && <Badge tone={whatsappConnectionStateTone(connection.state)}>{WHATSAPP_CONNECTION_STATE_LABEL[connection.state]}</Badge>}
        </div>
        {isConnected ? (
          <button type="button" onClick={handleDisconnect} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
            {busy && <Loader2 size={12} className="animate-spin" />}
            Disconnect
          </button>
        ) : (
          <button type="button" onClick={handleConnect} disabled={busy || !sdkReady} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
            {busy && <Loader2 size={12} className="animate-spin" />}
            Connect WhatsApp
          </button>
        )}
      </div>
      {connection?.displayPhoneNumber && (
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          {connection.displayPhoneNumber}
          {connection.qualityRating && connection.qualityRating !== "unknown" && <> · Quality: {connection.qualityRating}</>}
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Integrations Hub (Phase 6), Module 6.1 — one provider's full
 *  lifecycle state and actions. BuiltIn providers (WhatsApp/Email/AI)
 *  render read-only (their real connect/disconnect lifecycle already
 *  lives in environment configuration, not this registry) — a second
 *  set of buttons here would imply a second, competing way to manage
 *  them, which doesn't exist and shouldn't appear to. Business OS
 *  Phase 8, Module 8.2 adds ONE real write capability for builtIn
 *  providers on top of that read-only posture: TenantCredentialsForm,
 *  a per-organization credential override — additive, not a second
 *  competing connect/disconnect lifecycle. Module 8.5 adds a second,
 *  WhatsApp-specific additive capability: real Embedded Signup
 *  self-service connection, rendered only for provider.id==="whatsapp",
 *  never touching the email/AI builtIn cards' own rendering. */
function IntegrationCard({ integration, onChanged }: { integration: IntegrationSummary; onChanged: () => void }) {
  const { provider } = integration;
  const [busy, setBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAdvancedWhatsAppCredentials, setShowAdvancedWhatsAppCredentials] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [configText, setConfigText] = useState(() => JSON.stringify(integration.config, null, 2));
  const [configError, setConfigError] = useState<string | null>(null);
  const [showWebhookUrlForm, setShowWebhookUrlForm] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [webhookUrlError, setWebhookUrlError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const { data: logsData, loading: logsLoading } = useAdminData(
    () =>
      showLogs
        ? listIntegrationLogs(integration.provider.id, 1, 5)
        : Promise.resolve({ success: true as const, data: { items: [], total: 0, page: 1, limit: 5, totalPages: 0 } }),
    [showLogs, integration.provider.id],
  );

  // Calendar & Meeting Connectors (Module 6.3) — every provider in the
  // "calendar" category is a real 3-legged OAuth vendor, not a
  // JSON-config connection: "Connect" navigates the whole browser to
  // the vendor's own consent screen (oauth/authorize), rather than
  // POSTing an empty config the way every other category still does.
  const isOAuthProvider = provider.category === "calendar";

  // Generic Webhooks & Team Notifications (Module 6.5) — Slack/Teams/
  // Discord's real credential is one opaque Incoming Webhook URL (see
  // IntegrationCredentialRef's own "webhook_url" doc comment), so
  // "Connect" here opens an inline paste-the-URL form instead of
  // either an OAuth redirect or an empty-body POST.
  const isNotificationWebhookProvider = provider.category === "notifications" && !provider.builtIn;

  function handleConnect() {
    if (isOAuthProvider) {
      window.location.href = calendarOAuthAuthorizePath(provider.id as CalendarProviderId);
      return;
    }
    if (isNotificationWebhookProvider) {
      setShowWebhookUrlForm((v) => !v);
      return;
    }
    setBusy(true);
    connectIntegration(integration.provider.id, {}).finally(() => {
      setBusy(false);
      onChanged();
    });
  }

  async function handleConnectWebhookUrl(event: React.FormEvent) {
    event.preventDefault();
    setWebhookUrlError(null);
    if (!webhookUrlInput.trim()) return;
    setBusy(true);
    const result = await connectNotificationWebhookUrl(provider.id as NotificationProviderId, webhookUrlInput.trim());
    setBusy(false);
    if (!result.success) {
      setWebhookUrlError(result.errors[0]?.message ?? "Could not connect.");
      return;
    }
    setWebhookUrlInput("");
    setShowWebhookUrlForm(false);
    onChanged();
  }

  async function handleTestNotification() {
    setBusy(true);
    setTestResult(null);
    const result = await testNotification(provider.id as NotificationProviderId);
    setBusy(false);
    if (result.success) setTestResult(result.data.result);
    else setTestResult({ success: false, error: result.errors[0]?.message ?? "Test failed." });
  }

  async function handleDisconnect() {
    setBusy(true);
    await disconnectIntegration(integration.provider.id);
    setBusy(false);
    onChanged();
  }

  async function handleSyncNow() {
    setBusy(true);
    await syncCalendarProvider(provider.id as CalendarProviderId);
    setBusy(false);
    onChanged();
  }

  async function handleToggleEnabled() {
    setBusy(true);
    await setIntegrationEnabled(integration.provider.id, !integration.enabled);
    setBusy(false);
    onChanged();
  }

  async function handleSaveConfig() {
    setConfigError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = configText.trim() ? JSON.parse(configText) : {};
    } catch {
      setConfigError("Not valid JSON.");
      return;
    }
    setBusy(true);
    const result = await updateIntegrationConfig(integration.provider.id, parsed);
    setBusy(false);
    if (!result.success) {
      setConfigError(result.errors[0]?.message ?? "Could not save configuration.");
      return;
    }
    setShowConfig(false);
    onChanged();
  }

  return (
    <div className="adm-card space-y-2.5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            {provider.name}
          </p>
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            {provider.description}
          </p>
        </div>
        <span className="adm-chip" style={{ background: "var(--adm-surface-2)", color: "var(--adm-text-secondary)" }}>
          {INTEGRATION_CATEGORY_LABELS[provider.category]}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={integrationStatusTone(integration.status)}>{integration.status}</Badge>
        {integration.status === "connected" && <Badge tone={integration.enabled ? "success" : "neutral"}>{integration.enabled ? "enabled" : "disabled"}</Badge>}
        <Badge tone={integrationHealthTone(integration.health)}>{integration.health}</Badge>
      </div>

      {(integration.lastSuccessAt || integration.lastFailureAt) && (
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          {integration.lastSuccessAt && <>Last success: {new Date(integration.lastSuccessAt).toLocaleString()}</>}
          {integration.lastSuccessAt && integration.lastFailureAt && " · "}
          {integration.lastFailureAt && <>Last failure: {new Date(integration.lastFailureAt).toLocaleString()}</>}
        </p>
      )}
      {integration.lastError && (
        <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
          {integration.lastError}
        </p>
      )}

      {provider.builtIn ? (
        <>
          {provider.id === "whatsapp" ? (
            <>
              <WhatsAppEmbeddedSignupPanel onChanged={onChanged} />
              <button
                type="button"
                onClick={() => setShowAdvancedWhatsAppCredentials((v) => !v)}
                className="adm-focus-ring text-[11px] underline"
                style={{ color: "var(--adm-text-muted)" }}
              >
                {showAdvancedWhatsAppCredentials ? "Hide" : "Show"} advanced: manual credential configuration
              </button>
              {showAdvancedWhatsAppCredentials && <TenantCredentialsForm integration={integration} onChanged={onChanged} />}
            </>
          ) : (
            <>
              <p className="text-xs italic" style={{ color: "var(--adm-text-muted)" }}>
                Managed via environment configuration — not editable from this registry.
              </p>
              <TenantCredentialsForm integration={integration} onChanged={onChanged} />
            </>
          )}
        </>
      ) : (
        <>
          {provider.plannedModule && (
            <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
              Real functionality lands with {provider.plannedModule}. Connecting here only tracks intent/config, no
              live sync yet.
            </p>
          )}
          {isOAuthProvider && integration.status === "disconnected" && (
            <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
              Connecting redirects to {provider.name}&apos;s own sign-in and consent screen — no credentials are
              entered here.
            </p>
          )}
          {isNotificationWebhookProvider && integration.status === "disconnected" && (
            <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
              Connecting needs {provider.name}&apos;s own Incoming Webhook URL, pasted below — not an OAuth login.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {integration.status === "disconnected" ? (
              <button type="button" onClick={handleConnect} disabled={busy} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
                {busy && <Loader2 size={12} className="animate-spin" />}
                Connect
              </button>
            ) : (
              <>
                <button type="button" onClick={handleToggleEnabled} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                  {integration.enabled ? "Disable" : "Enable"}
                </button>
                <button type="button" onClick={handleDisconnect} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                  Disconnect
                </button>
                {isNotificationWebhookProvider ? (
                  <button type="button" onClick={handleConnect} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                    Update webhook URL
                  </button>
                ) : (
                  <button type="button" onClick={handleConnect} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                    Reconnect
                  </button>
                )}
                {isOAuthProvider && (
                  <button type="button" onClick={handleSyncNow} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                    <RefreshCw size={12} className={busy ? "animate-spin" : undefined} />
                    Sync now
                  </button>
                )}
                {isNotificationWebhookProvider && (
                  <button type="button" onClick={handleTestNotification} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                    Test Notification
                  </button>
                )}
                <button type="button" onClick={() => setShowConfig((v) => !v)} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                  Configure
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowLogs((v) => !v)}
              className="adm-focus-ring flex items-center gap-1 text-xs font-medium"
              style={{ color: "var(--adm-accent)" }}
            >
              Logs <ChevronDown size={12} style={{ transform: showLogs ? "rotate(180deg)" : undefined }} />
            </button>
          </div>

          {showWebhookUrlForm && (
            <form onSubmit={handleConnectWebhookUrl} className="space-y-1.5 border-t pt-2.5" style={{ borderColor: "var(--adm-border)" }}>
              <FormField
                id={`webhook-url-${provider.id}`}
                label={`${provider.name} Incoming Webhook URL`}
                type="url"
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full"
              />
              {webhookUrlError && (
                <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
                  {webhookUrlError}
                </p>
              )}
              <button type="submit" disabled={busy || !webhookUrlInput.trim()} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
                {busy && <Loader2 size={12} className="animate-spin" />}
                Save
              </button>
            </form>
          )}

          {testResult && (
            <p className="text-xs" style={{ color: testResult.success ? "var(--adm-success)" : "var(--adm-danger)" }}>
              {testResult.success ? "Test notification sent successfully." : (testResult.error ?? "Test notification failed.")}
            </p>
          )}

          {showConfig && integration.status === "connected" && (
            <div className="space-y-1.5 border-t pt-2.5" style={{ borderColor: "var(--adm-border)" }}>
              {isNotificationWebhookProvider && (
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  Set which events reach {provider.name}, e.g. <code>{"{ \"subscribedEventTypes\": [\"lead.created\", \"opportunity.won\"] }"}</code>. Omit it, or use <code>{"[\"*\"]"}</code>, to receive every event.
                </p>
              )}
              <textarea
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                rows={4}
                className="adm-focus-ring w-full rounded-[var(--adm-radius-sm)] border p-2 font-mono text-xs"
                style={{ borderColor: "var(--adm-border)", background: "var(--adm-bg-elevated)", color: "var(--adm-text)" }}
              />
              {configError && (
                <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
                  {configError}
                </p>
              )}
              <button type="button" onClick={handleSaveConfig} disabled={busy} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
                Save config
              </button>
            </div>
          )}

          {showLogs && (
            <div className="space-y-1 border-t pt-2.5" style={{ borderColor: "var(--adm-border)" }}>
              {logsLoading && <Skeleton className="h-3 w-full" />}
              {!logsLoading && logsData && logsData.items.length === 0 && (
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  No log entries yet.
                </p>
              )}
              {!logsLoading &&
                logsData &&
                logsData.items.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-2 text-xs" style={{ color: "var(--adm-text-muted)" }}>
                    <span>
                      {log.eventType} — {log.detail}
                    </span>
                    <span className="shrink-0">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const USAGE_METRIC_LABELS: Record<string, string> = {
  seats: "Team members",
  leads: "Leads",
  whatsapp_messages: "WhatsApp messages (this month)",
  whatsapp_campaign_sends: "Campaign sends (this month)",
  automation_executions: "Automation executions (this month)",
  ai_requests: "AI requests (this month)",
  storage_bytes: "File storage",
  integrations: "Connected integrations",
  webhook_deliveries: "Webhook deliveries (this month)",
};

function formatUsageValue(metric: string, value: number): string {
  if (metric === "storage_bytes") {
    if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
  }
  return value.toLocaleString();
}

const SUBSCRIPTION_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  cancelled: "neutral",
  suspended: "danger",
  expired: "danger",
};

/** Business OS Phase 8, Module 8.3 — extends the existing Settings
 *  page with the org's own commercial entitlement state (never a
 *  redesign): current plan, subscription status, renewal/trial dates,
 *  metered usage against plan limits, and an upgrade/cancel flow.
 *  Visible manager+ (read-only for a manager, matching every other
 *  billing-adjacent GET route's own `requiredRole: "manager"` floor);
 *  mutation actions (change plan, cancel) are admin-only, matching
 *  every other Settings-level mutation in this app. Server-side
 *  enforcement is authoritative regardless of what this panel shows —
 *  see entitlementService.assertCapability()/usageService's own doc
 *  comments; this UI is the courtesy layer on top of that, never a
 *  substitute for it. */
function BillingPanel({ isAdmin }: { isAdmin: boolean }) {
  const { data: subData, loading: subLoading, reload: reloadSub } = useAdminData(() => getSubscription(), []);
  const { data: usageData, loading: usageLoading, reload: reloadUsage } = useAdminData(() => getBillingUsage(), []);
  const { data: plansData } = useAdminData(() => listPlans(), []);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = () => {
    reloadSub();
    reloadUsage();
  };

  async function handleChangePlan() {
    if (!selectedPlanId) return;
    setActionError(null);
    setBusy(true);
    const result = await assignPlan(selectedPlanId);
    setBusy(false);
    if (!result.success) {
      setActionError(result.errors[0]?.message ?? "Could not change plan.");
      return;
    }
    setSelectedPlanId("");
    reload();
  }

  async function handleCancel() {
    setActionError(null);
    setBusy(true);
    const result = await cancelSubscription(false);
    setBusy(false);
    if (!result.success) {
      setActionError(result.errors[0]?.message ?? "Could not cancel subscription.");
      return;
    }
    reload();
  }

  if (subLoading || !subData) {
    return (
      <SettingsCard title="Billing">
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </SettingsCard>
    );
  }

  const { subscription, plan } = subData;
  const otherActivePlans = (plansData?.plans ?? []).filter((p) => p.status === "active" && p.id !== plan.id);

  return (
    <SettingsCard title="Billing">
      <div className="mt-3 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
              {plan.name}
            </p>
            <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
              {plan.description}
            </p>
          </div>
          <Badge tone={SUBSCRIPTION_STATUS_TONE[subscription.status] ?? "neutral"}>{subscription.status.replace("_", " ")}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "var(--adm-text-muted)" }}>
          {subscription.trialEndsAt && <p>Trial ends: {new Date(subscription.trialEndsAt).toLocaleDateString()}</p>}
          <p>Current period ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
          {subscription.cancelAt && <p style={{ color: "var(--adm-danger)" }}>Cancels on: {new Date(subscription.cancelAt).toLocaleDateString()}</p>}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            Usage this period
          </p>
          {usageLoading && <Skeleton className="h-3 w-full" />}
          {!usageLoading && (
            <div className="space-y-1.5">
              {(usageData?.usage ?? [])
                .filter((row) => row.limit !== null || row.current > 0)
                .map((row) => {
                  const pct = row.limit ? Math.min(100, Math.round((row.current / row.limit) * 100)) : 0;
                  return (
                    <div key={row.metric} className="text-xs">
                      <div className="flex items-center justify-between" style={{ color: "var(--adm-text-secondary)" }}>
                        <span>{USAGE_METRIC_LABELS[row.metric] ?? row.metric}</span>
                        <span>
                          {formatUsageValue(row.metric, row.current)} / {row.limit === null ? "Unlimited" : formatUsageValue(row.metric, row.limit)}
                        </span>
                      </div>
                      {row.limit !== null && (
                        <div className="mt-0.5 h-1.5 rounded-full" style={{ background: "var(--adm-surface-2)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: pct >= 100 ? "var(--adm-danger)" : pct >= 80 ? "var(--adm-warning)" : "var(--adm-accent)" }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--adm-border)" }}>
            {otherActivePlans.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <FilterSelect label="Change plan" value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} className="w-56">
                  <option value="">Select a plan…</option>
                  {otherActivePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </FilterSelect>
                <button type="button" onClick={handleChangePlan} disabled={busy || !selectedPlanId} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
                  {busy && <Loader2 size={12} className="animate-spin" />}
                  Change plan
                </button>
              </div>
            )}
            {subscription.status !== "cancelled" && !subscription.cancelAt && (
              <button type="button" onClick={handleCancel} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
                Cancel subscription (at period end)
              </button>
            )}
            {actionError && (
              <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
                {actionError}
              </p>
            )}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

/** Business OS Phase 8, Module 8.4 — White Label & Branding. Admin-only
 *  (view AND manage — unlike Billing's manager-can-view floor, branding
 *  is a whole-tenant-identity change, the same tier this app already
 *  gives Integrations). Entitlement-gated: an organization without the
 *  `white_label` plan capability sees a real, honest "requires a plan
 *  upgrade" empty state instead of a form that would just fail to save
 *  — server-side enforcement (`brandingService.updateConfiguration()`)
 *  remains authoritative regardless of what this panel shows or hides,
 *  per this module's own repeated "hiding a button is UX, never a
 *  substitute for enforcement" discipline. Reuses the exact upload
 *  pattern `LeadAttachmentsSection`/WhatsApp compose media already
 *  established (`uploadFile()` against the generic Module 6.2 file API,
 *  `category: "ORGANIZATION_ASSET"` — no new upload system) and the
 *  SAME `AdminBrandingContext` the live sidebar/header already render
 *  from for its own "Save" → "refresh the real applied theme" preview,
 *  never a fake, differently-implemented preview. */
function BrandingPanel() {
  const { data: configData, loading: configLoading, reload: reloadConfig } = useAdminData(() => getBrandConfiguration(), []);
  const { refresh: refreshAppliedBranding } = useAdminBranding();

  const [displayName, setDisplayName] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [footerText, setFooterText] = useState("");
  const [logoFileId, setLogoFileId] = useState<string | undefined>(undefined);
  const [compactLogoFileId, setCompactLogoFileId] = useState<string | undefined>(undefined);
  const [faviconFileId, setFaviconFileId] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const config = configData?.config;
  if (config && !hydrated) {
    setHydrated(true);
    setDisplayName(config.displayName ?? "");
    setAccentColor(config.accentColor ?? "");
    setPrimaryColor(config.primaryColor ?? "");
    setSupportEmail(config.supportEmail ?? "");
    setSupportUrl(config.supportUrl ?? "");
    setWebsiteUrl(config.websiteUrl ?? "");
    setFooterText(config.footerText ?? "");
    setLogoFileId(config.logoFileId);
    setCompactLogoFileId(config.compactLogoFileId);
    setFaviconFileId(config.faviconFileId);
  }

  async function handleUpload(field: "logo" | "compactLogo" | "favicon", file: File) {
    setUploadingField(field);
    setError(null);
    const result = await uploadFile(file, { category: "ORGANIZATION_ASSET", visibility: "public" });
    setUploadingField(null);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Upload failed.");
      return;
    }
    if (field === "logo") setLogoFileId(result.data.file.id);
    else if (field === "compactLogo") setCompactLogoFileId(result.data.file.id);
    else setFaviconFileId(result.data.file.id);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    setBusy(true);
    const result = await updateBrandConfiguration({
      displayName: displayName.trim() || null,
      accentColor: accentColor.trim() || null,
      primaryColor: primaryColor.trim() || null,
      supportEmail: supportEmail.trim() || null,
      supportUrl: supportUrl.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      footerText: footerText.trim() || null,
      logoFileId: logoFileId ?? null,
      compactLogoFileId: compactLogoFileId ?? null,
      faviconFileId: faviconFileId ?? null,
    });
    setBusy(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not save branding.");
      return;
    }
    setSaved(true);
    reloadConfig();
    refreshAppliedBranding();
  }

  async function handleReset() {
    setBusy(true);
    setError(null);
    const result = await resetBrandConfiguration();
    setBusy(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not reset branding.");
      return;
    }
    setHydrated(false);
    setDisplayName("");
    setAccentColor("");
    setPrimaryColor("");
    setSupportEmail("");
    setSupportUrl("");
    setWebsiteUrl("");
    setFooterText("");
    setLogoFileId(undefined);
    setCompactLogoFileId(undefined);
    setFaviconFileId(undefined);
    reloadConfig();
    refreshAppliedBranding();
  }

  if (configLoading) {
    return (
      <SettingsCard title="Branding">
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard title="Branding">
      <div className="mt-3 space-y-3">
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          Customize your organization&apos;s name, logo, and accent color across the admin dashboard. Requires a plan with white-label branding
          included — saving is rejected server-side otherwise, regardless of what this form shows.
        </p>

        <FormField id="brand-display-name" label="Organization display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="LearnSynaptic" className="w-full" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              { key: "logo", label: "Logo", fileId: logoFileId },
              { key: "compactLogo", label: "Compact logo", fileId: compactLogoFileId },
              { key: "favicon", label: "Favicon", fileId: faviconFileId },
            ] as const
          ).map(({ key, label, fileId }) => (
            <div key={key}>
              <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
                {label}
              </p>
              <label className="adm-focus-ring flex cursor-pointer items-center justify-center gap-1.5 rounded-[var(--adm-radius-sm)] border border-dashed p-3 text-xs" style={{ borderColor: "var(--adm-border-strong)", color: "var(--adm-text-muted)" }}>
                {uploadingField === key ? <Loader2 size={12} className="animate-spin" /> : fileId ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(key, file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="brand-accent" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
              Accent color
            </label>
            <div className="flex items-center gap-1.5">
              <input id="brand-accent" type="color" value={accentColor || "#6366f1"} onChange={(e) => setAccentColor(e.target.value)} className="h-8 w-10 rounded border" style={{ borderColor: "var(--adm-border)" }} />
              <FormField id="brand-accent-hex" label="" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder="#6366f1" className="w-28" />
            </div>
          </div>
          <div>
            <label htmlFor="brand-primary" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
              Secondary color
            </label>
            <div className="flex items-center gap-1.5">
              <input id="brand-primary" type="color" value={primaryColor || "#22d3ee"} onChange={(e) => setPrimaryColor(e.target.value)} className="h-8 w-10 rounded border" style={{ borderColor: "var(--adm-border)" }} />
              <FormField id="brand-primary-hex" label="" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#22d3ee" className="w-28" />
            </div>
          </div>
        </div>
        <p className="text-[11px]" style={{ color: "var(--adm-text-muted)" }}>
          Colors are checked for real WCAG contrast before saving — an unreadable choice (e.g. too light for white button text) is rejected with an explanation, never silently applied.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="brand-support-email" label="Support email" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@yourcompany.com" className="w-full" />
          <FormField id="brand-support-url" label="Support URL" type="url" value={supportUrl} onChange={(e) => setSupportUrl(e.target.value)} placeholder="https://yourcompany.com/help" className="w-full" />
          <FormField id="brand-website-url" label="Website URL" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://yourcompany.com" className="w-full" />
          <FormField id="brand-footer-text" label="Email footer text" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="© Your Company" className="w-full" />
        </div>

        {error && (
          <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="text-xs" style={{ color: "var(--adm-success)" }}>
            Branding saved — applied immediately across the dashboard.
          </p>
        )}

        <div className="flex gap-1.5">
          <button type="button" onClick={handleSave} disabled={busy} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
            {busy && <Loader2 size={12} className="animate-spin" />}
            Save branding
          </button>
          <button type="button" onClick={handleReset} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
            Reset to default
          </button>
        </div>
      </div>
    </SettingsCard>
  );
}

/** Integrations Hub (Phase 6), Module 6.1 — "Create or extend an
 *  Integrations area" per the module's own instruction: extends the
 *  existing Settings → Integrations section (which already held only
 *  WebhookDeliveriesPanel, module 2.4) with the provider registry
 *  itself, full-width above that panel's own small-card grid. */
function IntegrationsRegistryPanel() {
  const [category, setCategory] = useState<IntegrationCategory | "">("");
  const { data, loading, error, reload } = useAdminData(() => listIntegrations(), []);

  const integrations = data?.integrations.filter((i) => !category || i.provider.category === category) ?? [];

  return (
    <SettingsCard title="Provider Registry">
      <div className="mt-3 space-y-3">
        <FilterSelect label="Category" value={category} onChange={(e) => setCategory(e.target.value as IntegrationCategory | "")} className="w-56">
          <option value="">All categories</option>
          {INTEGRATION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {INTEGRATION_CATEGORY_LABELS[c]}
            </option>
          ))}
        </FilterSelect>

        {loading && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        )}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && integrations.length === 0 && <EmptyState message="No integrations in this category." />}
        {!loading && !error && integrations.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {integrations.map((integration) => (
              <IntegrationCard key={integration.provider.id} integration={integration} onChanged={reload} />
            ))}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

/**
 * WhatsApp Platform (Phase 2), Module 2.4 — Webhook & API Monitoring.
 * "New panel under Settings → Integrations" per the blueprint. Admin-
 * only (same tier as Audit Logs and Environment Configuration below):
 * this is operational/security visibility into raw webhook traffic,
 * not a CRM-configuration concern a Manager needs.
 */
function WebhookDeliveriesPanel() {
  const [page, setPage] = useState(1);
  const [outcome, setOutcome] = useState<WebhookDeliveryOutcome | "">("");
  const { data, loading, error, reload } = useAdminData(
    () => listWebhookDeliveries(outcome ? { outcome } : {}, page, 10),
    [page, outcome],
  );

  return (
    <SettingsCard title="Webhook Deliveries">
      <div className="mt-3 space-y-3">
        <FilterSelect
          label="Outcome"
          value={outcome}
          onChange={(e) => {
            setOutcome(e.target.value as WebhookDeliveryOutcome | "");
            setPage(1);
          }}
          className="w-full"
        >
          <option value="">All outcomes</option>
          {WEBHOOK_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </FilterSelect>

        {loading && <Skeleton className="h-24 w-full" />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && data && data.items.length === 0 && <EmptyState message="No webhook deliveries recorded yet." />}
        {!loading && !error && data && data.items.length > 0 && (
          <div className="space-y-1.5">
            {data.items.map((delivery) => (
              <div
                key={delivery.id}
                className="flex items-start justify-between gap-3 border-t py-2 first:border-t-0"
                style={{ borderColor: "var(--adm-border)" }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={webhookDeliveryOutcomeTone(delivery.outcome)}>{delivery.outcome}</Badge>
                    <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                      {delivery.source}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs" style={{ color: "var(--adm-text-secondary)" }} title={delivery.detail}>
                    {delivery.detail}
                  </p>
                </div>
                <span className="shrink-0 text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {new Date(delivery.receivedAt).toLocaleString()}
                </span>
              </div>
            ))}
            {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

/** Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 *  event-type picker shared by the registration form and (inline,
 *  read-only-labels-only) the "subscribed to" chips on each card.
 *  Checkboxes for the catalogued list + a free-text field, per
 *  CATALOGUED_EVENT_TYPES's own doc comment above. */
function EventTypeCheckboxes({
  selected,
  onToggle,
  allEvents,
  onToggleAll,
  customType,
  onCustomTypeChange,
  onAddCustomType,
}: {
  selected: Set<string>;
  onToggle: (eventType: string) => void;
  allEvents: boolean;
  onToggleAll: () => void;
  customType: string;
  onCustomTypeChange: (value: string) => void;
  onAddCustomType: () => void;
}) {
  return (
    <div className="space-y-2">
      <label className="adm-focus-ring flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--adm-text)" }}>
        <input type="checkbox" checked={allEvents} onChange={onToggleAll} />
        All events ({ALL_EVENTS_WILDCARD})
      </label>
      {!allEvents && (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {CATALOGUED_EVENT_TYPES.map((eventType) => (
              <label key={eventType} className="adm-focus-ring flex items-center gap-1.5 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
                <input type="checkbox" checked={selected.has(eventType)} onChange={() => onToggle(eventType)} />
                {eventType}
              </label>
            ))}
            {RESERVED_EVENT_TYPES.map((eventType) => (
              <label
                key={eventType}
                className="adm-focus-ring flex items-center gap-1.5 text-xs"
                style={{ color: "var(--adm-text-muted)" }}
                title="Reserved — not yet emitted (Module 6.4 Payments doesn't exist yet)."
              >
                <input type="checkbox" checked={selected.has(eventType)} onChange={() => onToggle(eventType)} />
                {eventType} <span className="italic">(reserved)</span>
              </label>
            ))}
          </div>
          <div className="flex items-end gap-1.5">
            <FormField
              id="custom-event-type"
              label="Add a custom/future event type"
              value={customType}
              onChange={(e) => onCustomTypeChange(e.target.value)}
              placeholder="e.g. custom.something"
              className="flex-1"
            />
            <button
              type="button"
              onClick={onAddCustomType}
              disabled={!customType.trim()}
              className="adm-focus-ring adm-btn adm-btn-secondary text-xs"
            >
              <Plus size={12} />
            </button>
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1">
              {[...selected].map((eventType) => (
                <span key={eventType} className="adm-chip" style={{ background: "var(--adm-surface-2)", color: "var(--adm-text-secondary)" }}>
                  {eventType}
                  <button type="button" aria-label={`Remove ${eventType}`} onClick={() => onToggle(eventType)} className="adm-focus-ring ml-1">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** One endpoint's Delivery History — filterable by outcome, with a
 *  Replay action on any row that didn't fully succeed. Mounted only
 *  while its parent card has it expanded (see WebhookEndpointCard's
 *  own showDeliveries state), the same lazy-fetch-on-expand shape
 *  IntegrationCard's own Logs section already established. */
function WebhookEndpointDeliveriesSection({ endpointId }: { endpointId: string }) {
  const [page, setPage] = useState(1);
  const [outcome, setOutcome] = useState<OutboundWebhookDeliveryOutcome | "">("");
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const { data, loading, error, reload } = useAdminData(
    () => listOutboundWebhookDeliveries(endpointId, outcome ? { outcome } : {}, page, 5),
    [endpointId, outcome, page],
  );

  async function handleReplay(attemptId: string) {
    setReplayingId(attemptId);
    await replayWebhookDelivery(endpointId, attemptId);
    setReplayingId(null);
    reload();
  }

  return (
    <div className="space-y-2 border-t pt-2.5" style={{ borderColor: "var(--adm-border)" }}>
      <FilterSelect
        label="Outcome"
        value={outcome}
        onChange={(e) => {
          setOutcome(e.target.value as OutboundWebhookDeliveryOutcome | "");
          setPage(1);
        }}
        className="w-full"
      >
        <option value="">All outcomes</option>
        {OUTBOUND_DELIVERY_OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </FilterSelect>

      {loading && <Skeleton className="h-16 w-full" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && data.items.length === 0 && <EmptyState message="No delivery attempts recorded yet." />}
      {!loading && !error && data && data.items.length > 0 && (
        <div className="space-y-1.5">
          {data.items.map((attempt) => (
            <div key={attempt.id} className="flex items-start justify-between gap-2 border-t pt-1.5 first:border-t-0" style={{ borderColor: "var(--adm-border)" }}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={outboundWebhookDeliveryOutcomeTone(attempt.outcome)}>{attempt.outcome}</Badge>
                  <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                    {attempt.eventType} · attempt {attempt.attempt}
                    {attempt.httpStatusCode ? ` · HTTP ${attempt.httpStatusCode}` : ""}
                  </span>
                </div>
                {attempt.error && (
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--adm-danger)" }} title={attempt.error}>
                    {attempt.error}
                  </p>
                )}
                <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {new Date(attempt.createdAt).toLocaleString()}
                </span>
              </div>
              {(attempt.outcome === "failed" || attempt.outcome === "dead_letter") && (
                <button
                  type="button"
                  onClick={() => handleReplay(attempt.id)}
                  disabled={replayingId === attempt.id}
                  className="adm-focus-ring adm-btn adm-btn-secondary shrink-0 text-xs"
                >
                  {replayingId === attempt.id && <Loader2 size={12} className="animate-spin" />}
                  Replay
                </button>
              )}
            </div>
          ))}
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
        </div>
      )}
    </div>
  );
}

/** One registered outbound Webhook Endpoint — health, delivery
 *  status, and every lifecycle action (Test/Rotate Secret/Enable-
 *  Disable/Delete/Update) the mission's own Admin UI section asks
 *  for, mirroring IntegrationCard's own card shape and action-row
 *  style. */
function WebhookEndpointCard({ endpoint, onChanged }: { endpoint: WebhookEndpoint; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; httpStatusCode?: number; error?: string } | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(endpoint.name);
  const [editUrl, setEditUrl] = useState(endpoint.url);
  const [editEventTypes, setEditEventTypes] = useState<Set<string>>(new Set(endpoint.subscribedEventTypes));
  const [editAllEvents, setEditAllEvents] = useState(endpoint.subscribedEventTypes.includes(ALL_EVENTS_WILDCARD));
  const [editCustomType, setEditCustomType] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  function toggleEditEventType(eventType: string) {
    setEditEventTypes((prev) => {
      const next = new Set(prev);
      if (next.has(eventType)) next.delete(eventType);
      else next.add(eventType);
      return next;
    });
  }

  function addEditCustomType() {
    if (!editCustomType.trim()) return;
    toggleEditEventType(editCustomType.trim());
    setEditCustomType("");
  }

  async function handleSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    setEditError(null);
    const subscribedEventTypes = editAllEvents ? [ALL_EVENTS_WILDCARD] : [...editEventTypes];
    if (!editName.trim() || !editUrl.trim() || subscribedEventTypes.length === 0) {
      setEditError("Name, URL, and at least one subscribed event type are required.");
      return;
    }
    setBusy(true);
    const result = await updateWebhookEndpoint(endpoint.id, { name: editName.trim(), url: editUrl.trim(), subscribedEventTypes });
    setBusy(false);
    if (!result.success) {
      setEditError(result.errors[0]?.message ?? "Could not save changes.");
      return;
    }
    setShowEdit(false);
    onChanged();
  }

  async function handleToggleEnabled() {
    setBusy(true);
    await setWebhookEndpointEnabled(endpoint.id, endpoint.status !== "active");
    setBusy(false);
    onChanged();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete webhook endpoint "${endpoint.name}"? This disables it permanently.`)) return;
    setBusy(true);
    await deleteWebhookEndpoint(endpoint.id);
    setBusy(false);
    onChanged();
  }

  async function handleRotateSecret() {
    if (!window.confirm(`Rotate the signing secret for "${endpoint.name}"? The old secret stops verifying immediately.`)) return;
    setBusy(true);
    const result = await rotateWebhookSecret(endpoint.id);
    setBusy(false);
    if (result.success) setRevealedSecret(result.data.secret);
    onChanged();
  }

  async function handleTest() {
    setBusy(true);
    setTestResult(null);
    const result = await testWebhookEndpoint(endpoint.id);
    setBusy(false);
    if (result.success) setTestResult(result.data.result);
    else setTestResult({ success: false, error: result.errors[0]?.message ?? "Test failed." });
    onChanged();
  }

  return (
    <div className="adm-card space-y-2.5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            {endpoint.name}
          </p>
          <p className="truncate text-xs" style={{ color: "var(--adm-text-muted)" }} title={endpoint.url}>
            {endpoint.url}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={webhookEndpointStatusTone(endpoint.status)}>{endpoint.status}</Badge>
        {endpoint.consecutiveFailures > 0 && (
          <Badge tone={endpoint.status === "auto_disabled" ? "danger" : "warning"}>{endpoint.consecutiveFailures} consecutive failures</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {endpoint.subscribedEventTypes.map((eventType) => (
          <span key={eventType} className="adm-chip" style={{ background: "var(--adm-surface-2)", color: "var(--adm-text-secondary)" }}>
            {eventType}
          </span>
        ))}
      </div>

      {(endpoint.lastSuccessAt || endpoint.lastFailureAt) && (
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          {endpoint.lastSuccessAt && <>Last success: {new Date(endpoint.lastSuccessAt).toLocaleString()}</>}
          {endpoint.lastSuccessAt && endpoint.lastFailureAt && " · "}
          {endpoint.lastFailureAt && <>Last failure: {new Date(endpoint.lastFailureAt).toLocaleString()}</>}
        </p>
      )}
      {endpoint.lastFailureReason && (
        <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
          {endpoint.lastFailureReason}
        </p>
      )}

      {revealedSecret && (
        <div className="space-y-1 rounded-[var(--adm-radius-sm)] border p-2" style={{ borderColor: "var(--adm-warning)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--adm-text)" }}>
            New signing secret — shown once, copy it now:
          </p>
          <code className="block break-all text-xs" style={{ color: "var(--adm-text-secondary)" }}>
            {revealedSecret}
          </code>
        </div>
      )}

      {testResult && (
        <p className="text-xs" style={{ color: testResult.success ? "var(--adm-success)" : "var(--adm-danger)" }}>
          {testResult.success
            ? `Test delivered successfully${testResult.httpStatusCode ? ` (HTTP ${testResult.httpStatusCode})` : ""}.`
            : (testResult.error ?? "Test delivery failed.")}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={handleTest} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
          Test
        </button>
        <button type="button" onClick={handleToggleEnabled} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
          {endpoint.status === "active" ? "Disable" : "Enable"}
        </button>
        <button type="button" onClick={handleRotateSecret} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
          Rotate secret
        </button>
        <button type="button" onClick={() => setShowEdit((v) => !v)} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
          Edit
        </button>
        <button type="button" onClick={handleDelete} disabled={busy} className="adm-focus-ring adm-btn adm-btn-secondary text-xs" style={{ color: "var(--adm-danger)" }}>
          Delete
        </button>
        <button
          type="button"
          onClick={() => setShowDeliveries((v) => !v)}
          className="adm-focus-ring flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--adm-accent)" }}
        >
          Delivery history <ChevronDown size={12} style={{ transform: showDeliveries ? "rotate(180deg)" : undefined }} />
        </button>
      </div>

      {showEdit && (
        <form onSubmit={handleSaveEdit} className="space-y-3 border-t pt-2.5" style={{ borderColor: "var(--adm-border)" }}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormField id={`edit-name-${endpoint.id}`} label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <FormField id={`edit-url-${endpoint.id}`} label="Endpoint URL" type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
          </div>
          <EventTypeCheckboxes
            selected={editEventTypes}
            onToggle={toggleEditEventType}
            allEvents={editAllEvents}
            onToggleAll={() => setEditAllEvents((v) => !v)}
            customType={editCustomType}
            onCustomTypeChange={setEditCustomType}
            onAddCustomType={addEditCustomType}
          />
          {editError && (
            <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
              {editError}
            </p>
          )}
          <button type="submit" disabled={busy} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
            {busy && <Loader2 size={12} className="animate-spin" />}
            Save changes
          </button>
        </form>
      )}

      {showDeliveries && <WebhookEndpointDeliveriesSection endpointId={endpoint.id} />}
    </div>
  );
}

/** Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 *  "Webhook Registry"/"Endpoint Management": register/list/manage
 *  outbound webhook endpoints, full-width above the Provider Registry
 *  panel's own card grid (registered endpoints are a distinct concept
 *  from Integrations Registry connections — see the codebase's own
 *  "many endpoints vs. one connection per provider" design note). */
function WebhookEndpointsPanel() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const { data, loading, error, reload } = useAdminData(() => listWebhookEndpoints({}, page, 10), [page]);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<string>>(new Set());
  const [allEvents, setAllEvents] = useState(false);
  const [customType, setCustomType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  function toggleEventType(eventType: string) {
    setSelectedEventTypes((prev) => {
      const next = new Set(prev);
      if (next.has(eventType)) next.delete(eventType);
      else next.add(eventType);
      return next;
    });
  }

  function addCustomType() {
    if (!customType.trim()) return;
    toggleEventType(customType.trim());
    setCustomType("");
  }

  function resetForm() {
    setName("");
    setUrl("");
    setSelectedEventTypes(new Set());
    setAllEvents(false);
    setCustomType("");
    setFormError(null);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const subscribedEventTypes = allEvents ? [ALL_EVENTS_WILDCARD] : [...selectedEventTypes];
    if (!name.trim() || !url.trim() || subscribedEventTypes.length === 0) {
      setFormError("Name, URL, and at least one subscribed event type are required.");
      return;
    }
    setSubmitting(true);
    const result = await registerWebhookEndpoint({ name: name.trim(), url: url.trim(), subscribedEventTypes });
    setSubmitting(false);
    if (!result.success) {
      setFormError(result.errors[0]?.message ?? "Could not register endpoint.");
      return;
    }
    setCreatedSecret(result.data.secret);
    resetForm();
    setShowForm(false);
    reload();
  }

  return (
    <SettingsCard title="Webhook Endpoints">
      <div className="mt-3 space-y-3">
        {createdSecret && (
          <div className="space-y-1 rounded-[var(--adm-radius-sm)] border p-2" style={{ borderColor: "var(--adm-warning)" }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium" style={{ color: "var(--adm-text)" }}>
                Signing secret — shown once, copy it now:
              </p>
              <button type="button" onClick={() => setCreatedSecret(null)} className="adm-focus-ring adm-icon-btn" aria-label="Dismiss">
                <X size={12} />
              </button>
            </div>
            <code className="block break-all text-xs" style={{ color: "var(--adm-text-secondary)" }}>
              {createdSecret}
            </code>
          </div>
        )}

        <button type="button" onClick={() => setShowForm((v) => !v)} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
          <Plus size={12} />
          {showForm ? "Cancel" : "Register endpoint"}
        </button>

        {showForm && (
          <form onSubmit={handleCreate} className="adm-card space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField id="webhook-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Zapier inbound" />
              <FormField id="webhook-url" label="Endpoint URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook" />
            </div>
            <EventTypeCheckboxes
              selected={selectedEventTypes}
              onToggle={toggleEventType}
              allEvents={allEvents}
              onToggleAll={() => setAllEvents((v) => !v)}
              customType={customType}
              onCustomTypeChange={setCustomType}
              onAddCustomType={addCustomType}
            />
            {formError && (
              <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
                {formError}
              </p>
            )}
            <button type="submit" disabled={submitting} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Register
            </button>
          </form>
        )}

        {loading && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        )}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && data && data.items.length === 0 && <EmptyState message="No webhook endpoints registered yet." />}
        {!loading && !error && data && data.items.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map((endpoint) => (
                <WebhookEndpointCard key={endpoint.id} endpoint={endpoint} onChanged={reload} />
              ))}
            </div>
            {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

const CALENDAR_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  denied: "The OAuth consent screen was cancelled or denied — nothing was connected.",
  invalid_request: "The OAuth callback was missing required parameters.",
  connection_failed: "Couldn't complete the connection — the provider rejected the request or the session expired. Try connecting again.",
};

/** Calendar & Meeting Connectors (Module 6.3) — reads the
 *  `calendarConnected`/`calendarError` query params the OAuth callback
 *  route redirects back with, per this app's own useSearchParams
 *  precedent (app/admin/login/page.tsx), which is why this is a
 *  separate component wrapped in Suspense rather than read inline. */
function CalendarOAuthBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const connected = searchParams.get("calendarConnected");
  const errorCode = searchParams.get("calendarError");
  if (!connected && !errorCode) return null;

  function dismiss() {
    router.replace(pathname);
  }

  if (connected) {
    return (
      <div className="adm-card flex items-center justify-between gap-3 p-3" style={{ borderColor: "var(--adm-success)" }}>
        <p className="flex items-center gap-2 text-sm" style={{ color: "var(--adm-text)" }}>
          <CheckCircle2 size={16} style={{ color: "var(--adm-success)" }} /> Connected successfully.
        </p>
        <button type="button" onClick={dismiss} className="adm-focus-ring adm-icon-btn" aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="adm-card flex items-center justify-between gap-3 p-3" style={{ borderColor: "var(--adm-danger)" }}>
      <p className="flex items-center gap-2 text-sm" style={{ color: "var(--adm-text)" }}>
        <AlertCircle size={16} style={{ color: "var(--adm-danger)" }} />
        {CALENDAR_OAUTH_ERROR_MESSAGES[errorCode ?? ""] ?? "Couldn't complete the connection."}
      </p>
      <button type="button" onClick={dismiss} className="adm-focus-ring adm-icon-btn" aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { user } = useAdminAuth();
  const { data, loading, error, forbidden, reload } = useAdminData(() => getSettings(), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
          Settings
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
          <Info size={14} /> CRM Configuration is editable directly. Environment Configuration is read-only —
          change it by updating the deployment.
        </p>
      </div>

      <Suspense fallback={null}>
        <CalendarOAuthBanner />
      </Suspense>

      {/* CRM Configuration is manager+ and rendered independently of the
       *  env-settings snapshot below (admin-only) — a manager who can't
       *  see JWT/database config must still be able to manage Tags,
       *  Custom Fields, and the Assignment Rule, the same "gate each
       *  section by its own actual permission" shape the Analytics
       *  page's Leaderboard section already established. */}
      {(user?.role === "manager" || user?.role === "admin") && (
        <div>
          <h2 className="!text-sm font-bold" style={{ color: "var(--adm-text)" }}>
            CRM Configuration
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TagsPanel />
            <CustomFieldsPanel />
            <AssignmentRulePanel />
          </div>
        </div>
      )}

      {/* Business OS Phase 8, Module 8.3 — manager+ visibility (read-only
       *  for a manager), matching every other billing-adjacent GET
       *  route's own requiredRole floor; mutation actions inside
       *  BillingPanel are gated further by isAdmin. */}
      {(user?.role === "manager" || user?.role === "admin") && (
        <div>
          <h2 className="!text-sm font-bold" style={{ color: "var(--adm-text)" }}>
            Billing
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <BillingPanel isAdmin={user?.role === "admin"} />
          </div>
        </div>
      )}

      {/* Business OS Phase 8, Module 8.4 — admin-only for both view and
       *  manage, unlike Billing's manager-can-view floor: branding is a
       *  whole-tenant-identity change, the same tier Integrations
       *  already requires (see the mission's own explicit RBAC
       *  section: "Counsellor: No branding configuration", "Tenant
       *  Admin: Manage permitted organization branding"). */}
      {user?.role === "admin" && (
        <div>
          <h2 className="!text-sm font-bold" style={{ color: "var(--adm-text)" }}>
            Branding
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <BrandingPanel />
          </div>
        </div>
      )}

      {/* Module 2.4 — admin-only, same tier as Environment Configuration
       *  below: raw webhook traffic visibility, not a CRM setting.
       *  Module 6.1 extends this same section with the Integrations
       *  Registry itself, full-width above the smaller cards below. */}
      {user?.role === "admin" && (
        <div>
          <h2 className="!text-sm font-bold" style={{ color: "var(--adm-text)" }}>
            Integrations
          </h2>
          <div className="mt-3">
            <IntegrationsRegistryPanel />
          </div>
          <div className="mt-4">
            <WebhookEndpointsPanel />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <WebhookDeliveriesPanel />
          </div>
        </div>
      )}

      <div>
        <h2 className="!text-sm font-bold" style={{ color: "var(--adm-text)" }}>
          Environment Configuration
        </h2>
        <div className="mt-3">
          {loading && (
            <div role="status" aria-label="Loading settings" className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <SettingsCardSkeleton key={i} />
              ))}
            </div>
          )}
          {!loading && forbidden && <ForbiddenState role={user?.role} />}
          {!loading && !forbidden && (error || !data) && (
            <ErrorState message={error ?? "Could not load settings."} onRetry={reload} />
          )}
          {!loading && !forbidden && !error && data && renderSnapshot(data.settings)}
        </div>
      </div>
    </div>
  );
}
