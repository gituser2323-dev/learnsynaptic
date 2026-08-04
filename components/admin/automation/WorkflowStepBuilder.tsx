"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { listTags, listStaff } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { FormField } from "@/components/admin/FormField";
// Deliberately NOT importing from "@/lib/services/automation" (the
// barrel) here: that barrel also re-exports triggers.ts, which pulls in
// lib/db → mongoose → Node-only modules (tls/net) that can't bundle for
// the browser. ACTION_TYPES/CONDITION_TYPES/DELAY_UNITS come straight
// from validation.ts, which only imports types from ./types — nothing
// server-only — and the domain types are `import type`, fully erased
// before the bundler ever sees them, so they're safe from either path.
import { ACTION_TYPES, CONDITION_TYPES, DELAY_UNITS } from "@/lib/services/automation/validation";
import type {
  PersistedWorkflowStep,
  WorkflowActionType,
  WorkflowConditionType,
  WorkflowStepDelay,
  RetryPolicy,
} from "@/lib/services/automation/types";

/**
 * Module 3.2 — Visual Workflow Builder. Replaces the raw-JSON step
 * editor (module 3.1/3.3's disclosed boundary) with a structured form
 * driven by the same action/condition registries the server resolves
 * against (`ACTION_TYPES`/`CONDITION_TYPES`/`DELAY_UNITS`, re-exported
 * from `lib/services/automation/validation.ts` so this UI and the
 * server validator can't drift apart). `PersistedWorkflowStep[]` is
 * still the wire format — this only changes how a human constructs it.
 *
 * The server now validates per-action-type required params too
 * (`validateActionParams` in validation.ts, added as a fast-follow
 * hardening pass after this module shipped — see CHANGELOG.md) — this
 * component's own `validateStepsClientSide` checks are UX (fail fast,
 * in the form, before a round-trip), not the only gate anymore. Kept
 * as a second, independent list of required fields rather than a
 * shared import, since this file can't import validation.ts's non-type
 * exports without pulling in server-only code — see that function's
 * own doc comment.
 */

type StringDict = Record<string, unknown>;

function strParam(params: StringDict, key: string): string {
  const v = params[key];
  return typeof v === "string" ? v : "";
}

function numParam(params: StringDict, key: string): string {
  const v = params[key];
  return typeof v === "number" && Number.isFinite(v) ? String(v) : "";
}

interface TemplateVariableRow {
  field: string;
  fallback: string;
}

function variablesParam(params: StringDict): TemplateVariableRow[] {
  const v = params.variables;
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is TemplateVariableRow =>
      !!x && typeof x === "object" && typeof (x as StringDict).field === "string" && typeof (x as StringDict).fallback === "string",
  );
}

function setParam(params: StringDict, key: string, value: unknown): StringDict {
  return { ...params, [key]: value };
}

const ACTION_LABELS: Record<WorkflowActionType, string> = {
  send_whatsapp_template: "Send WhatsApp Template",
  assign_lead: "Assign Lead",
  add_tag: "Add Tag",
  create_task: "Create Task",
  send_email: "Send Email",
  analyze_lead_ai: "Analyze Lead with AI",
  analyze_conversation_ai: "Analyze Conversation with AI",
  schedule_meeting: "Schedule Meeting",
};

// Module 6.3's own provider ids, hardcoded here rather than imported
// from "@/lib/services/calendar" — that barrel re-exports
// calendarService, which pulls in lib/db → mongoose, the identical
// "can't bundle for the browser" trap this file's own top-of-file
// comment already documents for lib/services/automation's barrel.
const CALENDAR_PROVIDER_OPTIONS = [
  { id: "google_calendar", label: "Google Calendar" },
  { id: "google_meet", label: "Google Meet" },
  { id: "microsoft_outlook_calendar", label: "Microsoft Outlook Calendar" },
  { id: "microsoft_teams_meetings", label: "Microsoft Teams (Meetings)" },
  { id: "zoom", label: "Zoom" },
] as const;

const CONDITION_LABELS: Record<WorkflowConditionType, string> = {
  lead_not_registered: "Lead is not registered",
};

function defaultParamsFor(actionType: WorkflowActionType): StringDict {
  switch (actionType) {
    case "send_whatsapp_template":
      return { templateName: "", variables: [] };
    case "assign_lead":
      return { counsellorId: "" };
    case "add_tag":
      return { tagId: "" };
    case "create_task":
      return { title: "", assigneeId: "", priority: "medium" };
    case "send_email":
      return { subject: "", body: "" };
    case "analyze_lead_ai":
      return {};
    case "analyze_conversation_ai":
      return {};
    case "schedule_meeting":
      return { provider: "google_calendar", title: "", durationMinutes: 30, startInMinutes: 60 };
  }
}

function defaultDelay(): WorkflowStepDelay {
  return { amount: 1, unit: "days" };
}

function defaultRetry(): RetryPolicy {
  return { maxAttempts: 3, backoff: { amount: 30, unit: "minutes" } };
}

let stepCounter = 0;
function newStepId(): string {
  stepCounter += 1;
  return `step-${Date.now()}-${stepCounter}`;
}

export function newEmptyStep(): PersistedWorkflowStep {
  return { id: newStepId(), action: { type: "send_whatsapp_template", params: defaultParamsFor("send_whatsapp_template") } };
}

/** Client-side gate for the params the server never checks (see this
 *  file's own doc comment). Returns the first problem found, or null. */
export function validateStepsClientSide(steps: PersistedWorkflowStep[]): string | null {
  if (steps.length === 0) return "At least one step is required.";
  const seenIds = new Set<string>();
  for (const step of steps) {
    if (!step.id.trim()) return "Every step needs an id.";
    if (seenIds.has(step.id)) return `Duplicate step id "${step.id}".`;
    seenIds.add(step.id);

    const p = step.action.params;
    if (step.action.type === "send_whatsapp_template" && !strParam(p, "templateName").trim()) {
      return `Step "${step.id}": template name is required.`;
    }
    if (step.action.type === "assign_lead" && !strParam(p, "counsellorId").trim()) {
      return `Step "${step.id}": a counsellor is required.`;
    }
    if (step.action.type === "add_tag" && !strParam(p, "tagId").trim()) {
      return `Step "${step.id}": a tag is required.`;
    }
    if (step.action.type === "create_task") {
      if (!strParam(p, "title").trim()) return `Step "${step.id}": task title is required.`;
      if (!strParam(p, "assigneeId").trim()) return `Step "${step.id}": an assignee is required.`;
    }
    if (step.action.type === "send_email") {
      if (!strParam(p, "subject").trim()) return `Step "${step.id}": email subject is required.`;
      if (!strParam(p, "body").trim()) return `Step "${step.id}": email body is required.`;
    }
    if (step.action.type === "schedule_meeting") {
      if (!strParam(p, "provider").trim()) return `Step "${step.id}": a calendar provider is required.`;
      if (!strParam(p, "title").trim()) return `Step "${step.id}": meeting title is required.`;
    }
    if (step.condition && !step.condition.description.trim()) {
      return `Step "${step.id}": condition description is required.`;
    }
  }
  return null;
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="adm-input adm-focus-ring w-full">
        {children}
      </select>
    </div>
  );
}

function ActionParamsEditor({
  idPrefix,
  actionType,
  params,
  onChange,
  tags,
  staff,
}: {
  idPrefix: string;
  actionType: WorkflowActionType;
  params: StringDict;
  onChange: (params: StringDict) => void;
  tags: { id: string; label: string }[];
  staff: { id: string; name?: string; email: string }[];
}) {
  if (actionType === "send_whatsapp_template") {
    const variables = variablesParam(params);
    function updateVariable(index: number, field: "field" | "fallback", value: string) {
      const next = variables.map((v, i) => (i === index ? { ...v, [field]: value } : v));
      onChange(setParam(params, "variables", next));
    }
    return (
      <div className="space-y-2">
        <FormField
          id={`${idPrefix}-templateName`}
          label="Template name"
          value={strParam(params, "templateName")}
          onChange={(e) => onChange(setParam(params, "templateName", e.target.value))}
          placeholder="lead_welcome_v1"
        />
        <div>
          <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            Template variables
          </p>
          <div className="space-y-1.5">
            {variables.map((v, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  aria-label={`Variable ${i + 1} field`}
                  value={v.field}
                  onChange={(e) => updateVariable(i, "field", e.target.value)}
                  placeholder="field, e.g. name"
                  className="adm-input adm-focus-ring flex-1"
                />
                <input
                  aria-label={`Variable ${i + 1} fallback`}
                  value={v.fallback}
                  onChange={(e) => updateVariable(i, "fallback", e.target.value)}
                  placeholder="fallback, e.g. there"
                  className="adm-input adm-focus-ring flex-1"
                />
                <button
                  type="button"
                  onClick={() => onChange(setParam(params, "variables", variables.filter((_, j) => j !== i)))}
                  aria-label="Remove variable"
                  className="adm-focus-ring adm-icon-btn"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange(setParam(params, "variables", [...variables, { field: "", fallback: "" }]))}
              className="adm-focus-ring adm-btn adm-btn-secondary text-xs"
            >
              <Plus size={12} /> Add variable
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (actionType === "assign_lead") {
    return (
      <SelectField
        id={`${idPrefix}-counsellorId`}
        label="Assign to"
        value={strParam(params, "counsellorId")}
        onChange={(v) => onChange(setParam(params, "counsellorId", v))}
      >
        <option value="">Select a counsellor…</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name ?? s.email}
          </option>
        ))}
      </SelectField>
    );
  }

  if (actionType === "add_tag") {
    return (
      <SelectField
        id={`${idPrefix}-tagId`}
        label="Tag"
        value={strParam(params, "tagId")}
        onChange={(v) => onChange(setParam(params, "tagId", v))}
      >
        <option value="">Select a tag…</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </SelectField>
    );
  }

  if (actionType === "send_email") {
    return (
      <div className="space-y-2">
        <FormField
          id={`${idPrefix}-subject`}
          label="Subject"
          value={strParam(params, "subject")}
          onChange={(e) => onChange(setParam(params, "subject", e.target.value))}
          placeholder="Welcome to LearnSynaptic!"
        />
        <div>
          <label htmlFor={`${idPrefix}-body`} className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            Body
          </label>
          <textarea
            id={`${idPrefix}-body`}
            value={strParam(params, "body")}
            onChange={(e) => onChange(setParam(params, "body", e.target.value))}
            rows={4}
            className="adm-focus-ring w-full rounded-[var(--adm-radius-sm)] border p-2.5 text-sm"
            style={{ borderColor: "var(--adm-border)", background: "var(--adm-bg-elevated)", color: "var(--adm-text)" }}
            placeholder="Hi there, thanks for your interest…"
          />
        </div>
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          Plain text only — no template variables (unlike WhatsApp templates,
          regular email has no pre-approval concept to interpolate against).
        </p>
      </div>
    );
  }

  if (actionType === "analyze_lead_ai") {
    return (
      <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
        No configuration needed — runs AI Lead Insights on this workflow&apos;s lead, the same analysis the
        lead&apos;s &quot;Analyze Again&quot; button triggers. Degrades gracefully (no automation failure) if no AI
        provider is configured.
      </p>
    );
  }

  if (actionType === "analyze_conversation_ai") {
    return (
      <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
        No configuration needed — analyzes this lead&apos;s most recently active Conversation, if any (sentiment,
        intent, buying readiness, and more). No-ops if the lead has no conversation yet; degrades gracefully if no AI
        provider is configured.
      </p>
    );
  }

  if (actionType === "schedule_meeting") {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SelectField
            id={`${idPrefix}-provider`}
            label="Calendar provider"
            value={strParam(params, "provider") || "google_calendar"}
            onChange={(v) => onChange(setParam(params, "provider", v))}
          >
            {CALENDAR_PROVIDER_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </SelectField>
          <FormField
            id={`${idPrefix}-durationMinutes`}
            label="Duration (minutes)"
            type="number"
            min={1}
            value={numParam(params, "durationMinutes")}
            onChange={(e) => onChange(setParam(params, "durationMinutes", e.target.value === "" ? undefined : Number(e.target.value)))}
            placeholder="30 (default)"
          />
        </div>
        <FormField
          id={`${idPrefix}-meetingTitle`}
          label="Meeting title"
          value={strParam(params, "title")}
          onChange={(e) => onChange(setParam(params, "title", e.target.value))}
          placeholder="Counselling call"
        />
        <FormField
          id={`${idPrefix}-startInMinutes`}
          label="Starts in (minutes from when this step runs)"
          type="number"
          min={0}
          value={numParam(params, "startInMinutes")}
          onChange={(e) => onChange(setParam(params, "startInMinutes", e.target.value === "" ? undefined : Number(e.target.value)))}
          placeholder="60 (default)"
        />
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          Invites the lead at the email address on file. The chosen provider must be connected and enabled in
          Settings → Integrations before this step can run — see Module 6.3.
        </p>
      </div>
    );
  }

  // create_task
  return (
    <div className="space-y-2">
      <FormField
        id={`${idPrefix}-title`}
        label="Task title"
        value={strParam(params, "title")}
        onChange={(e) => onChange(setParam(params, "title", e.target.value))}
        placeholder="Follow up with lead"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SelectField
          id={`${idPrefix}-assigneeId`}
          label="Assignee"
          value={strParam(params, "assigneeId")}
          onChange={(v) => onChange(setParam(params, "assigneeId", v))}
        >
          <option value="">Select an assignee…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? s.email}
            </option>
          ))}
        </SelectField>
        <FormField
          id={`${idPrefix}-dueInDays`}
          label="Due in (days)"
          type="number"
          min={0}
          value={numParam(params, "dueInDays")}
          onChange={(e) => onChange(setParam(params, "dueInDays", e.target.value === "" ? undefined : Number(e.target.value)))}
          placeholder="1 (default)"
        />
        <SelectField
          id={`${idPrefix}-priority`}
          label="Priority"
          value={strParam(params, "priority") || "medium"}
          onChange={(v) => onChange(setParam(params, "priority", v))}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </SelectField>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-description`} className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
          Description (optional)
        </label>
        <textarea
          id={`${idPrefix}-description`}
          value={strParam(params, "description")}
          onChange={(e) => onChange(setParam(params, "description", e.target.value))}
          rows={2}
          className="adm-focus-ring w-full rounded-[var(--adm-radius-sm)] border p-2.5 text-sm"
          style={{ borderColor: "var(--adm-border)", background: "var(--adm-bg-elevated)", color: "var(--adm-text)" }}
        />
      </div>
    </div>
  );
}

function DelayFields({
  idPrefix,
  delay,
  onChange,
}: {
  idPrefix: string;
  delay: WorkflowStepDelay;
  onChange: (delay: WorkflowStepDelay) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <FormField
        id={`${idPrefix}-delay-amount`}
        label="Amount"
        type="number"
        min={1}
        value={String(delay.amount)}
        onChange={(e) => onChange({ ...delay, amount: Number(e.target.value) || 1 })}
      />
      <SelectField
        id={`${idPrefix}-delay-unit`}
        label="Unit"
        value={delay.unit}
        onChange={(v) => onChange({ ...delay, unit: v as WorkflowStepDelay["unit"] })}
      >
        {DELAY_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

function RetryFields({
  idPrefix,
  retry,
  onChange,
}: {
  idPrefix: string;
  retry: RetryPolicy;
  onChange: (retry: RetryPolicy) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <FormField
        id={`${idPrefix}-retry-max`}
        label="Max attempts"
        type="number"
        min={1}
        value={String(retry.maxAttempts)}
        onChange={(e) => onChange({ ...retry, maxAttempts: Number(e.target.value) || 1 })}
      />
      <FormField
        id={`${idPrefix}-retry-backoff-amount`}
        label="Backoff amount"
        type="number"
        min={1}
        value={String(retry.backoff.amount)}
        onChange={(e) => onChange({ ...retry, backoff: { ...retry.backoff, amount: Number(e.target.value) || 1 } })}
      />
      <SelectField
        id={`${idPrefix}-retry-backoff-unit`}
        label="Backoff unit"
        value={retry.backoff.unit}
        onChange={(v) => onChange({ ...retry, backoff: { ...retry.backoff, unit: v as WorkflowStepDelay["unit"] } })}
      >
        {DELAY_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

function WorkflowStepEditorCard({
  step,
  index,
  total,
  tags,
  staff,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  step: PersistedWorkflowStep;
  index: number;
  total: number;
  tags: { id: string; label: string }[];
  staff: { id: string; name?: string; email: string }[];
  onChange: (step: PersistedWorkflowStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const idPrefix = `wf-step-${step.id}`;

  return (
    <div className="rounded-[var(--adm-radius-sm)] border p-4" style={{ borderColor: "var(--adm-border)", background: "var(--adm-bg-elevated)" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-secondary)" }}>
          Step {index + 1}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            aria-label="Move step up"
            className="adm-focus-ring adm-icon-btn disabled:opacity-30"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            aria-label="Move step down"
            className="adm-focus-ring adm-icon-btn disabled:opacity-30"
          >
            <ChevronDown size={14} />
          </button>
          <button type="button" onClick={onRemove} aria-label="Remove step" className="adm-focus-ring adm-icon-btn">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <FormField
          id={`${idPrefix}-id`}
          label="Step id"
          value={step.id}
          onChange={(e) => onChange({ ...step, id: e.target.value })}
          placeholder="welcome-message"
        />

        <div>
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
            <input
              type="checkbox"
              checked={!!step.delay}
              onChange={(e) => onChange({ ...step, delay: e.target.checked ? defaultDelay() : undefined })}
              className="adm-focus-ring"
            />
            Wait before running this step
          </label>
          {step.delay && (
            <div className="mt-2">
              <DelayFields idPrefix={idPrefix} delay={step.delay} onChange={(delay) => onChange({ ...step, delay })} />
            </div>
          )}
        </div>

        <SelectField
          id={`${idPrefix}-action-type`}
          label="Action"
          value={step.action.type}
          onChange={(v) => {
            const actionType = v as WorkflowActionType;
            onChange({ ...step, action: { type: actionType, params: defaultParamsFor(actionType) } });
          }}
        >
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACTION_LABELS[t]}
            </option>
          ))}
        </SelectField>
        <ActionParamsEditor
          idPrefix={idPrefix}
          actionType={step.action.type}
          params={step.action.params}
          onChange={(params) => onChange({ ...step, action: { ...step.action, params } })}
          tags={tags}
          staff={staff}
        />

        <div>
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
            <input
              type="checkbox"
              checked={!!step.condition}
              onChange={(e) =>
                onChange({
                  ...step,
                  condition: e.target.checked ? { type: CONDITION_TYPES[0], description: "" } : undefined,
                })
              }
              className="adm-focus-ring"
            />
            Only run this step if…
          </label>
          {step.condition && (
            <div className="mt-2 space-y-2">
              <SelectField
                id={`${idPrefix}-condition-type`}
                label="Condition"
                value={step.condition.type}
                onChange={(v) => onChange({ ...step, condition: { ...step.condition!, type: v as WorkflowConditionType } })}
              >
                {CONDITION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CONDITION_LABELS[t]}
                  </option>
                ))}
              </SelectField>
              <FormField
                id={`${idPrefix}-condition-description`}
                label="Description (shown in logs when this step is skipped)"
                value={step.condition.description}
                onChange={(e) => onChange({ ...step, condition: { ...step.condition!, description: e.target.value } })}
                placeholder="Skip if this lead has already registered"
              />
              <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                This condition has no configurable params.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
            <input
              type="checkbox"
              checked={!!step.retryPolicy}
              onChange={(e) => onChange({ ...step, retryPolicy: e.target.checked ? defaultRetry() : undefined })}
              className="adm-focus-ring"
            />
            Retry on failure
          </label>
          {step.retryPolicy && (
            <div className="mt-2">
              <RetryFields idPrefix={idPrefix} retry={step.retryPolicy} onChange={(retryPolicy) => onChange({ ...step, retryPolicy })} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkflowStepBuilder({
  steps,
  onChange,
}: {
  steps: PersistedWorkflowStep[];
  onChange: (steps: PersistedWorkflowStep[]) => void;
}) {
  const { data: tagsData } = useAdminData(() => listTags(), []);
  const { data: staffData } = useAdminData(() => listStaff(), []);
  const tags = tagsData?.tags ?? [];
  const staff = staffData?.users ?? [];

  function updateStep(index: number, next: PersistedWorkflowStep) {
    onChange(steps.map((s, i) => (i === index ? next : s)));
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <WorkflowStepEditorCard
          key={step.id || index}
          step={step}
          index={index}
          total={steps.length}
          tags={tags}
          staff={staff}
          onChange={(next) => updateStep(index, next)}
          onRemove={() => removeStep(index)}
          onMoveUp={() => moveStep(index, -1)}
          onMoveDown={() => moveStep(index, 1)}
        />
      ))}
      <button
        type="button"
        onClick={() => onChange([...steps, newEmptyStep()])}
        className="adm-focus-ring adm-btn adm-btn-secondary text-xs"
      >
        <Plus size={13} /> Add step
      </button>
    </div>
  );
}
