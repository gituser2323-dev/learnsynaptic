"use client";

import { useState } from "react";
import { GitMerge, Loader2 } from "lucide-react";
import { listDuplicates, mergeLeads } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { Badge, leadStatusTone } from "@/components/admin/Badge";
import { ForbiddenState, ErrorState, EmptyState, LoadingState } from "@/components/admin/DataStates";
import type { DuplicateLeadGroup, Lead } from "@/lib/services/leads";

/**
 * Enterprise CRM (Phase 1) — Duplicate Detection review queue. Reached
 * from the Leads page's "Duplicates" button rather than its own sidebar
 * entry (an earlier decision this session: this is a queue you clear,
 * not a destination you visit routinely like Leads/Tasks/Pipeline).
 */
function MergeGroupCard({ group, onMerged }: { group: DuplicateLeadGroup; onMerged: () => void }) {
  const [targetId, setTargetId] = useState(group.leads[0].id);
  const [busy, setBusy] = useState(false);

  const target = group.leads.find((l) => l.id === targetId) ?? group.leads[0];
  const sources = group.leads.filter((l) => l.id !== targetId);

  async function handleMerge(sourceId: string) {
    if (!window.confirm("Merge this lead into the selected target? The other record will be deleted.")) return;
    setBusy(true);
    await mergeLeads(targetId, sourceId);
    setBusy(false);
    onMerged();
  }

  return (
    <div className="adm-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
          Matched on {group.matchedOn}: {group.matchedValue}
        </p>
        <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          {group.leads.length} records
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {group.leads.map((lead: Lead) => (
          <label
            key={lead.id}
            className="flex cursor-pointer flex-col gap-1 rounded-[var(--adm-radius-md)] border p-3"
            style={{
              borderColor: lead.id === targetId ? "var(--adm-accent)" : "var(--adm-border)",
              background: lead.id === targetId ? "var(--adm-accent-soft)" : "transparent",
            }}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name={`target-${group.matchedValue}`}
                checked={lead.id === targetId}
                onChange={() => setTargetId(lead.id)}
                className="adm-focus-ring"
              />
              <span className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>
                {lead.name}
              </span>
              <Badge tone={leadStatusTone(lead.status)}>{lead.status}</Badge>
            </div>
            <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
              {lead.email} · {lead.phone}
            </p>
            <p className="text-[11px]" style={{ color: "var(--adm-text-muted)" }}>
              Created {new Date(lead.createdAt).toLocaleDateString()} · source: {lead.source}
            </p>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          Keep <strong>{target.name}</strong>, merge in:
        </span>
        {sources.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={busy}
            onClick={() => handleMerge(s.id)}
            className="adm-focus-ring adm-btn adm-btn-secondary"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            <GitMerge size={14} /> {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminLeadDuplicatesPage() {
  const { user } = useAdminAuth();
  const { data, loading, error, forbidden, reload } = useAdminData(() => listDuplicates(), []);

  return (
    <div className="space-y-6">
      <div className="adm-animate-in">
        <h1 className="!text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
          Duplicate Leads
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
          Records sharing the same phone or email. Pick which one to keep, then merge the rest into it.
        </p>
      </div>

      {loading && <LoadingState label="Scanning for duplicates…" />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && <ErrorState message={error ?? "Could not load duplicates."} onRetry={reload} />}
      {!loading && !forbidden && !error && data && data.groups.length === 0 && (
        <EmptyState message="No duplicate leads found." />
      )}
      {!loading && !forbidden && !error && data && data.groups.length > 0 && (
        <div className="space-y-4">
          {data.groups.map((group) => (
            <MergeGroupCard key={`${group.matchedOn}-${group.matchedValue}`} group={group} onMerged={reload} />
          ))}
        </div>
      )}
    </div>
  );
}
