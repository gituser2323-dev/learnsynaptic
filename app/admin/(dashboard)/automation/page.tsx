"use client";

import { useState } from "react";
import { Loader2, PlayCircle, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  listWorkflowRuns,
  listWorkflowDefinitions,
  createWorkflowDefinition,
  updateWorkflowDefinition,
  deleteWorkflowDefinition,
  listAutoReplyRules,
  createAutoReplyRule,
  updateAutoReplyRule,
  deleteAutoReplyRule,
  runDueScheduledJobs,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { FilterInput, FilterSelect } from "@/components/admin/FilterControls";
import { FormField } from "@/components/admin/FormField";
import { Badge, workflowRunStatusTone } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import { WorkflowStepBuilder, newEmptyStep, validateStepsClientSide } from "@/components/admin/automation/WorkflowStepBuilder";
import type { WorkflowRun, WorkflowRunStatus, WorkflowDefinitionRecord, AutoReplyRule, PersistedWorkflowStep } from "@/lib/services/automation";

const STATUS_OPTIONS: WorkflowRunStatus[] = ["pending", "waiting", "completed", "failed", "cancelled"];
const PAGE_SIZE = 20;

const RUN_COLUMNS: TableColumn<WorkflowRun>[] = [
  { key: "workflowId", header: "Workflow", render: (r) => r.workflowId },
  { key: "entity", header: "Entity", render: (r) => `${r.entityType} · ${r.entityId}` },
  { key: "status", header: "Status", render: (r) => <Badge tone={workflowRunStatusTone(r.status)}>{r.status}</Badge> },
  { key: "step", header: "Step", align: "right", render: (r) => r.currentStepIndex },
  { key: "attempts", header: "Attempts", align: "right", render: (r) => r.attempts },
  { key: "nextRunAt", header: "Next Run At", render: (r) => new Date(r.nextRunAt).toLocaleString() },
  { key: "lastError", header: "Last Error", render: (r) => r.lastError ?? "—" },
];

/**
 * Module 3.1 — Persisted Workflow Definitions. Each card is a
 * WorkflowDefinitionRecord loaded from the database (no longer a
 * static, code-defined list), editable in place: toggle it
 * active/inactive, or expand its steps in the structured builder
 * (Module 3.2) and save a new version. Steps are still
 * `PersistedWorkflowStep[]` on the wire — the builder only changes how
 * a human constructs that array, against the same action/condition
 * registries (lib/services/automation/{actions,conditions}) the server
 * resolves against.
 */
function WorkflowDefinitionCard({
  workflow,
  onChanged,
}: {
  workflow: WorkflowDefinitionRecord;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [steps, setSteps] = useState<PersistedWorkflowStep[]>(() => workflow.steps);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleToggleActive() {
    setBusy(true);
    setError(null);
    const result = await updateWorkflowDefinition(workflow.id, { active: !workflow.active });
    setBusy(false);
    if (result.success) onChanged();
    else setError(result.errors[0]?.message ?? "Could not update this workflow.");
  }

  async function handleSaveSteps() {
    const clientError = validateStepsClientSide(steps);
    if (clientError) {
      setError(clientError);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await updateWorkflowDefinition(workflow.id, { steps });
    setBusy(false);
    if (result.success) onChanged();
    else setError(result.errors[0]?.message ?? "Could not save these steps.");
  }

  async function handleDelete() {
    if (!confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    const result = await deleteWorkflowDefinition(workflow.id);
    setBusy(false);
    if (result.success) onChanged();
    else setError(result.errors[0]?.message ?? "Could not delete this workflow.");
  }

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--adm-border)", background: "var(--adm-surface)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold" style={{ color: "var(--adm-text)" }}>
            {workflow.name}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
            <code>{workflow.id}</code> · triggered by <code>{workflow.triggerEventType}</code>
          </p>
        </div>
        <Badge tone={workflow.active ? "success" : "neutral"}>{workflow.active ? "Active" : "Inactive"}</Badge>
      </div>

      <ol className="mt-3 space-y-1.5 text-sm">
        {workflow.steps.map((step, index) => (
          <li key={step.id} className="flex flex-wrap items-baseline gap-x-2" style={{ color: "var(--adm-text)" }}>
            <span style={{ color: "var(--adm-text-secondary)" }}>{index + 1}.</span>
            <span className="font-medium">{step.id}</span>
            <span className="text-xs" style={{ color: "var(--adm-text-secondary)" }}>
              {step.action.type}
            </span>
            {step.delay && (
              <span className="text-xs" style={{ color: "var(--adm-text-secondary)" }}>
                after {step.delay.amount} {step.delay.unit}
              </span>
            )}
            {step.condition && (
              <span className="text-xs" style={{ color: "var(--adm-text-secondary)" }}>
                if: {step.condition.description}
              </span>
            )}
            {step.retryPolicy && (
              <span className="text-xs" style={{ color: "var(--adm-text-secondary)" }}>
                retries up to {step.retryPolicy.maxAttempts}×
              </span>
            )}
          </li>
        ))}
      </ol>

      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={handleToggleActive}
          className="adm-focus-ring adm-btn adm-btn-secondary"
        >
          {workflow.active ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="adm-focus-ring adm-btn adm-btn-secondary"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Edit steps
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleDelete}
          aria-label={`Delete workflow ${workflow.name}`}
          className="adm-focus-ring adm-icon-btn ml-auto"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <WorkflowStepBuilder steps={steps} onChange={setSteps} />
          <button
            type="button"
            disabled={busy}
            onClick={handleSaveSteps}
            className="adm-focus-ring adm-btn adm-btn-primary"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Save steps
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Module 3.2 — Visual Workflow Builder. Steps are authored through
 * `WorkflowStepBuilder`'s structured form, driven by the same
 * action/condition registries the server resolves against
 * (send_whatsapp_template / assign_lead / add_tag / create_task;
 * lead_not_registered), not hand-written JSON.
 */
function NewWorkflowForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [triggerEventType, setTriggerEventType] = useState("lead.created");
  const [steps, setSteps] = useState<PersistedWorkflowStep[]>(() => [newEmptyStep()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const clientError = validateStepsClientSide(steps);
    if (clientError) {
      setError(clientError);
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await createWorkflowDefinition({
      id: id.trim(),
      name: name.trim(),
      triggerEventType: triggerEventType.trim(),
      steps,
    });
    setSubmitting(false);

    if (result.success) {
      setOpen(false);
      setId("");
      setName("");
      setSteps([newEmptyStep()]);
      onCreated();
    } else {
      setError(result.errors[0]?.message ?? "Could not create this workflow.");
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="adm-focus-ring adm-btn adm-btn-secondary">
        <Plus size={14} />
        New workflow
      </button>
    );
  }

  return (
    <form
      onSubmit={handleCreate}
      className="rounded-2xl border p-5"
      style={{ borderColor: "var(--adm-border)", background: "var(--adm-surface)" }}
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <FormField id="new-workflow-id" label="Id" value={id} onChange={(e) => setId(e.target.value)} placeholder="lead-nurture-sequence" />
        <FormField id="new-workflow-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead nurture" />
        <FormField
          id="new-workflow-trigger"
          label="Trigger event type"
          value={triggerEventType}
          onChange={(e) => setTriggerEventType(e.target.value)}
          placeholder="lead.created"
        />
      </div>
      <p className="mt-3 mb-1.5 text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
        Steps
      </p>
      <WorkflowStepBuilder steps={steps} onChange={setSteps} />
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={submitting} className="adm-focus-ring adm-btn adm-btn-primary">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Create workflow
        </button>
        <button type="button" onClick={() => setOpen(false)} className="adm-focus-ring adm-btn adm-btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function WorkflowCatalog() {
  const { data, loading, error, reload } = useAdminData(() => listWorkflowDefinitions(), []);

  return (
    <div className="space-y-4">
      {loading && <TableSkeleton rows={2} columns={3} />}
      {!loading && (error || !data) && <ErrorState message={error ?? "Could not load workflow catalog."} onRetry={reload} />}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.items.map((workflow) => (
              <WorkflowDefinitionCard key={workflow.id} workflow={workflow} onChanged={reload} />
            ))}
          </div>
          {data.items.length === 0 && <EmptyState message="No workflows are registered." />}
          <NewWorkflowForm onCreated={reload} />
        </>
      )}
    </div>
  );
}

/**
 * Module 3.3 — Auto-Reply Engine. Keyword rules matched case-insensitive
 * substring against an inbound message body, first match (oldest rule
 * first) wins; an optional fallback rule fires when nothing matches. No
 * per-conversation cooldown exists yet — disclosed here, not hidden.
 */
function AutoReplyRuleRow({ rule, onChanged }: { rule: AutoReplyRule; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleActive() {
    setBusy(true);
    setError(null);
    const result = await updateAutoReplyRule(rule.id, { active: !rule.active });
    setBusy(false);
    if (result.success) onChanged();
    else setError(result.errors[0]?.message ?? "Could not update this rule.");
  }

  async function handleDelete() {
    if (!confirm(rule.isFallback ? "Delete the fallback rule?" : `Delete this rule (${rule.keywords.join(", ")})?`)) return;
    setBusy(true);
    setError(null);
    const result = await deleteAutoReplyRule(rule.id);
    setBusy(false);
    if (result.success) onChanged();
    else setError("Could not delete this rule.");
  }

  return (
    <div data-testid="auto-reply-rule" className="border-t py-3 first:border-t-0" style={{ borderColor: "var(--adm-border)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {rule.isFallback ? (
              <Badge tone="info">Fallback</Badge>
            ) : (
              rule.keywords.map((k) => (
                <span key={k} className="adm-chip">
                  {k}
                </span>
              ))
            )}
            <Badge tone={rule.active ? "success" : "neutral"}>{rule.active ? "Active" : "Inactive"}</Badge>
          </div>
          <p className="mt-1.5 text-sm" style={{ color: "var(--adm-text)" }}>
            {rule.replyText}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" disabled={busy} onClick={handleToggleActive} className="adm-focus-ring adm-btn adm-btn-secondary">
            {rule.active ? "Deactivate" : "Activate"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            aria-label="Delete rule"
            className="adm-focus-ring adm-icon-btn"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function NewAutoReplyRuleForm({ onCreated }: { onCreated: () => void }) {
  const [keywords, setKeywords] = useState("");
  const [replyText, setReplyText] = useState("");
  const [isFallback, setIsFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createAutoReplyRule({
      keywords: isFallback ? [] : keywords.split(",").map((k) => k.trim()).filter(Boolean),
      replyText: replyText.trim(),
      isFallback,
    });
    setSubmitting(false);
    if (result.success) {
      setKeywords("");
      setReplyText("");
      setIsFallback(false);
      onCreated();
    } else {
      setError(result.errors[0]?.message ?? "Could not create this rule.");
    }
  }

  return (
    <form onSubmit={handleCreate} className="mt-4 space-y-2">
      {!isFallback && (
        <FormField
          id="new-auto-reply-keywords"
          label="Keywords (comma-separated)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="pricing, cost, fees"
        />
      )}
      <div>
        <label htmlFor="new-auto-reply-text" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
          Reply text
        </label>
        <textarea
          id="new-auto-reply-text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={3}
          className="adm-focus-ring w-full rounded-[var(--adm-radius-sm)] border p-2.5 text-sm"
          style={{ borderColor: "var(--adm-border)", background: "var(--adm-bg-elevated)", color: "var(--adm-text)" }}
        />
      </div>
      <label className="flex items-center gap-2 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
        <input type="checkbox" checked={isFallback} onChange={(e) => setIsFallback(e.target.checked)} className="adm-focus-ring" />
        This is the fallback reply (sent when no keyword rule matches)
      </label>
      {error && (
        <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || !replyText.trim() || (!isFallback && !keywords.trim())}
        className="adm-focus-ring adm-btn adm-btn-secondary w-full"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Add rule
      </button>
    </form>
  );
}

function AutoReplyRulesPanel() {
  const { data, loading, error, reload } = useAdminData(() => listAutoReplyRules(), []);

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--adm-border)", background: "var(--adm-surface)" }}>
      <p className="text-xs" style={{ color: "var(--adm-text-secondary)" }}>
        Sent automatically for every inbound WhatsApp message that matches a keyword (or the fallback rule, if none
        match) — no cooldown per conversation yet, so a contact messaging repeatedly gets a reply each time.
      </p>
      {loading && <TableSkeleton rows={2} columns={2} />}
      {!loading && (error || !data) && <ErrorState message={error ?? "Could not load auto-reply rules."} onRetry={reload} />}
      {!loading && !error && data && (
        <>
          {data.rules.length === 0 ? (
            <p className="mt-3 text-xs" style={{ color: "var(--adm-text-muted)" }}>
              No auto-reply rules yet.
            </p>
          ) : (
            <div className="mt-1">
              {data.rules.map((rule) => (
                <AutoReplyRuleRow key={rule.id} rule={rule} onChanged={reload} />
              ))}
            </div>
          )}
          <NewAutoReplyRuleForm onCreated={reload} />
        </>
      )}
    </div>
  );
}

function RunSchedulerTrigger() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setResult(null);
    const response = await runDueScheduledJobs();
    setRunning(false);
    setResult(
      response.success
        ? `Processed ${response.data.processed} due job${response.data.processed === 1 ? "" : "s"}.`
        : (response.errors[0]?.message ?? "Could not run the scheduler."),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={running}
        onClick={handleRun}
        className="flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition disabled:opacity-70"
        style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
      >
        {running ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={15} />}
        Run Due Jobs Now
      </button>
      {result && <p className="text-xs" style={{ color: "var(--adm-text-secondary)" }}>{result}</p>}
    </div>
  );
}

export default function AdminAutomationPage() {
  const { user } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<WorkflowRunStatus | "">("");
  const [entityType, setEntityType] = useState("");

  const filters = { status: status || undefined, entityType: entityType || undefined };

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listWorkflowRuns(filters, page, PAGE_SIZE),
    [page, status, entityType],
  );

  function onFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
            Automation
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Registered workflow definitions and their run history. Runs are processed on a schedule — use &quot;Run Due
            Jobs Now&quot; below to process anything due right away instead of waiting for the next run.
          </p>
        </div>
        <RunSchedulerTrigger />
      </div>

      <section>
        <h2 className="mb-3 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-secondary)" }}>
          Workflow Catalog
        </h2>
        <WorkflowCatalog />
      </section>

      <section>
        <h2 className="mb-3 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-secondary)" }}>
          Auto-Reply Rules
        </h2>
        <AutoReplyRulesPanel />
      </section>

      <section className="space-y-4">
        <h2 className="!text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-secondary)" }}>
          Run History
        </h2>

        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="Filter by status"
            value={status}
            onChange={(event) => onFilterChange(setStatus)(event.target.value as WorkflowRunStatus | "")}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </FilterSelect>
          <FilterInput
            label="Filter by entity type"
            placeholder="Entity type, e.g. Lead"
            value={entityType}
            onChange={(event) => onFilterChange(setEntityType)(event.target.value)}
            className="w-48"
          />
        </div>

        {loading && <TableSkeleton rows={8} columns={RUN_COLUMNS.length} />}
        {!loading && forbidden && <ForbiddenState role={user?.role} />}
        {!loading && !forbidden && (error || !data) && (
          <ErrorState message={error ?? "Could not load workflow runs."} onRetry={reload} />
        )}
        {!loading &&
          !forbidden &&
          !error &&
          data &&
          (data.items.length === 0 ? (
            <EmptyState message="No workflow runs match these filters." />
          ) : (
            <div className="space-y-4">
              <Table columns={RUN_COLUMNS} rows={data.items} getRowKey={(r) => r.id} />
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
            </div>
          ))}
      </section>
    </div>
  );
}
