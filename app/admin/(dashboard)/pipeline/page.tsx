"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import {
  listPipelines,
  listOpportunities,
  createOpportunity,
  createPipeline,
  deletePipeline,
  moveOpportunityStage,
  listStaff,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { FormField } from "@/components/admin/FormField";
import { FilterSelect } from "@/components/admin/FilterControls";
import { ForbiddenState, ErrorState, LoadingState } from "@/components/admin/DataStates";
import type { Opportunity, Pipeline, PipelineStage } from "@/lib/services/crm/pipelines";

/**
 * Enterprise CRM (Phase 1) — Pipeline / Opportunity Kanban. Native HTML5
 * drag-and-drop (no new dependency — the same "don't add a library
 * without real justification" discipline the CSV-import decision
 * already documented). Won/Lost status is never decided client-side —
 * dropping a card just tells the server "move to stage X," and
 * pipelineService.moveStage() derives won/lost from that stage's own
 * isWon/isLost flags (see that service's own comment) — this board
 * always reflects what the server actually recorded, not a client-side
 * guess about which stage means "won."
 */

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", opportunity.id)}
      className="adm-card cursor-grab p-3 active:cursor-grabbing"
      style={{ borderColor: "var(--adm-border)" }}
    >
      <p className="text-xs font-medium" style={{ color: "var(--adm-text)" }}>
        Lead {opportunity.leadId.slice(-6)}
      </p>
      {opportunity.expectedRevenueInr !== undefined && (
        <p className="mt-1 text-xs" style={{ color: "var(--adm-text-muted)" }}>
          ₹{opportunity.expectedRevenueInr.toLocaleString("en-IN")} · {opportunity.probability}%
        </p>
      )}
      <Link href={`/admin/leads/${opportunity.leadId}`} className="mt-1 block text-[11px] underline" style={{ color: "var(--adm-accent)" }}>
        View lead
      </Link>
    </div>
  );
}

function StageColumn({
  stage,
  opportunities,
  onDrop,
}: {
  stage: PipelineStage;
  opportunities: Opportunity[];
  onDrop: (opportunityId: string, stageId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const opportunityId = e.dataTransfer.getData("text/plain");
        if (opportunityId) onDrop(opportunityId, stage.id);
      }}
      className="flex w-64 shrink-0 flex-col gap-2 rounded-[var(--adm-radius-lg)] border p-3"
      style={{
        borderColor: dragOver ? "var(--adm-accent)" : "var(--adm-border)",
        background: dragOver ? "var(--adm-accent-soft)" : "var(--adm-surface-2)",
      }}
    >
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
          {stage.name}
        </p>
        <span className="text-xs font-medium" style={{ color: "var(--adm-text-muted)" }}>
          {opportunities.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}
      </div>
    </div>
  );
}

function CreateOpportunityForm({ pipelineId, stageId, onCreated }: { pipelineId: string; stageId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [revenue, setRevenue] = useState("");
  const { data: staff } = useAdminData(() => listStaff(), []);
  const [ownerId, setOwnerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!leadId.trim()) return;
    setSubmitting(true);
    const result = await createOpportunity({
      leadId: leadId.trim(),
      pipelineId,
      stageId,
      expectedRevenueInr: revenue ? Number(revenue) : undefined,
      ownerId: ownerId || undefined,
    });
    setSubmitting(false);
    if (result.success) {
      setLeadId("");
      setRevenue("");
      setOpen(false);
      onCreated();
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="adm-focus-ring adm-btn adm-btn-primary">
        <Plus size={15} /> New Opportunity
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="adm-card space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField id="opp-lead-id" label="Lead ID" value={leadId} onChange={(e) => setLeadId(e.target.value)} required placeholder="Paste a Lead id from the Leads page" />
        <FormField id="opp-revenue" label="Expected revenue (₹)" type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
        <FilterSelect label="Owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full">
          <option value="">No owner</option>
          {staff?.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
        </FilterSelect>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting || !leadId.trim()} className="adm-focus-ring adm-btn adm-btn-primary">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Create
        </button>
        <button type="button" onClick={() => setOpen(false)} className="adm-focus-ring adm-btn adm-btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

interface StageDraft {
  key: string;
  name: string;
  isWon: boolean;
  isLost: boolean;
}

let stageKeySeq = 0;
function newStageDraft(): StageDraft {
  stageKeySeq += 1;
  return { key: `s${stageKeySeq}`, name: "", isWon: false, isLost: false };
}

/** Enterprise CRM (Phase 1) — "custom pipelines per program." Every
 *  pipeline created here is additive alongside the seeded default (see
 *  pipelineService.createPipeline's own comment) — this form never
 *  touches or replaces it. */
function CreatePipelineForm({ onCreated }: { onCreated: (pipelineId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [program, setProgram] = useState("");
  const [stages, setStages] = useState<StageDraft[]>([newStageDraft(), newStageDraft()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validStages = stages.filter((s) => s.name.trim());

  function updateStage(key: string, patch: Partial<StageDraft>) {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || validStages.length === 0) return;
    setSubmitting(true);
    setError(null);
    const result = await createPipeline({
      name: name.trim(),
      program: program.trim() || undefined,
      stages: validStages.map((s) => ({ name: s.name.trim(), isWon: s.isWon, isLost: s.isLost })),
    });
    setSubmitting(false);
    if (result.success) {
      setOpen(false);
      setName("");
      setProgram("");
      setStages([newStageDraft(), newStageDraft()]);
      onCreated(result.data.pipeline.id);
    } else {
      setError(result.errors[0]?.message ?? "Could not create pipeline.");
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="adm-focus-ring adm-btn adm-btn-secondary">
        <Plus size={15} /> New Pipeline
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "var(--adm-overlay)" }} onClick={() => setOpen(false)} />
      <form
        onSubmit={handleSubmit}
        className="adm-animate-pop relative w-full max-w-lg space-y-4 rounded-[var(--adm-radius-lg)] border p-5 shadow-2xl"
        style={{ background: "var(--adm-bg-elevated)", borderColor: "var(--adm-border-strong)", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            New Pipeline
          </p>
          <button type="button" onClick={() => setOpen(false)} className="adm-focus-ring adm-icon-btn">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="new-pipeline-name" label="Pipeline name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. GenAI Builder Cohort" />
          <FormField id="new-pipeline-program" label="Program (optional)" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="e.g. genai-builder" />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            Stages, in order
          </p>
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <div key={stage.key} className="flex items-center gap-2">
                <span className="w-5 text-right text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {index + 1}
                </span>
                <input
                  value={stage.name}
                  onChange={(e) => updateStage(stage.key, { name: e.target.value })}
                  placeholder="Stage name"
                  className="adm-input adm-focus-ring flex-1"
                />
                <label className="flex items-center gap-1 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
                  <input type="checkbox" checked={stage.isWon} onChange={(e) => updateStage(stage.key, { isWon: e.target.checked, isLost: e.target.checked ? false : stage.isLost })} className="adm-focus-ring" />
                  Won
                </label>
                <label className="flex items-center gap-1 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
                  <input type="checkbox" checked={stage.isLost} onChange={(e) => updateStage(stage.key, { isLost: e.target.checked, isWon: e.target.checked ? false : stage.isWon })} className="adm-focus-ring" />
                  Lost
                </label>
                <button
                  type="button"
                  aria-label={`Remove stage ${index + 1}`}
                  onClick={() => setStages((prev) => prev.filter((s) => s.key !== stage.key))}
                  disabled={stages.length <= 1}
                  className="adm-focus-ring adm-icon-btn"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStages((prev) => [...prev, newStageDraft()])}
            className="adm-focus-ring mt-2 text-xs font-medium"
            style={{ color: "var(--adm-accent)" }}
          >
            <Plus size={12} className="inline" /> Add stage
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--adm-danger)" }}>
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={submitting || !name.trim() || validStages.length === 0} className="adm-focus-ring adm-btn adm-btn-primary">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create pipeline
          </button>
          <button type="button" onClick={() => setOpen(false)} className="adm-focus-ring adm-btn adm-btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminPipelinePage() {
  const { user } = useAdminAuth();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { data: pipelinesData, loading: loadingPipelines, error: pipelinesError, forbidden, reload: reloadPipelines } = useAdminData(
    () => listPipelines(),
    [],
  );
  const pipelines: Pipeline[] = pipelinesData?.pipelines ?? [];
  const pipeline = pipelines.find((p) => p.id === selectedPipelineId) ?? pipelines[0];

  const {
    data: oppsData,
    loading: loadingOpps,
    error: oppsError,
    reload,
  } = useAdminData(() => listOpportunities(pipeline ? { pipelineId: pipeline.id } : {}), [pipeline?.id]);

  if (loadingPipelines) return <LoadingState label="Loading pipeline…" />;
  if (forbidden) return <ForbiddenState role={user?.role} />;
  if (pipelinesError || !pipeline) return <ErrorState message={pipelinesError ?? "Could not load the pipeline."} />;

  async function handleDrop(opportunityId: string, stageId: string) {
    const lostStage = pipeline!.stages.find((s) => s.id === stageId)?.isLost;
    const lostReason = lostStage ? window.prompt("Lost reason (optional):") ?? undefined : undefined;
    await moveOpportunityStage(opportunityId, stageId, lostReason);
    reload();
  }

  async function handleDeletePipeline() {
    if (!pipeline || pipeline.isDefault) return;
    if (!window.confirm(`Delete pipeline "${pipeline.name}"? This cannot be undone.`)) return;
    setDeleteError(null);
    const result = await deletePipeline(pipeline.id);
    if (result.success) {
      setSelectedPipelineId(null);
      reloadPipelines();
    } else {
      setDeleteError(result.errors[0]?.message ?? "Could not delete pipeline.");
    }
  }

  const opportunities = oppsData?.opportunities ?? [];

  return (
    <div className="space-y-6">
      <div className="adm-animate-in flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="!text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
            Pipeline
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            {pipeline.name}
            {pipeline.program && ` · ${pipeline.program}`} — drag a card to advance its stage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pipelines.length > 1 && (
            <FilterSelect
              label="Select pipeline"
              value={pipeline.id}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="w-56"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isDefault ? " (default)" : ""}
                </option>
              ))}
            </FilterSelect>
          )}
          {!pipeline.isDefault && (
            <button type="button" onClick={handleDeletePipeline} className="adm-focus-ring adm-btn adm-btn-secondary" style={{ color: "var(--adm-danger)" }}>
              <Trash2 size={14} /> Delete pipeline
            </button>
          )}
          <CreatePipelineForm onCreated={(id) => { setSelectedPipelineId(id); reloadPipelines(); }} />
          <CreateOpportunityForm pipelineId={pipeline.id} stageId={pipeline.stages[0]?.id ?? ""} onCreated={reload} />
        </div>
      </div>

      {deleteError && (
        <p role="alert" className="text-sm" style={{ color: "var(--adm-danger)" }}>
          {deleteError}
        </p>
      )}

      {loadingOpps && <LoadingState label="Loading opportunities…" />}
      {!loadingOpps && oppsError && <ErrorState message={oppsError} onRetry={reload} />}
      {!loadingOpps && !oppsError && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {pipeline.stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              opportunities={opportunities.filter((o) => o.stageId === stage.id)}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
