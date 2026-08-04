"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Upload, GitMerge, Loader2, X } from "lucide-react";
import {
  listLeads,
  leadsCsvHref,
  listTags,
  listStaff,
  bulkLeadAction,
  previewLeadImport,
  commitLeadImport,
  type LeadImportPreviewResponse,
  type LeadImportCommitResponse,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { FilterInput, FilterSelect } from "@/components/admin/FilterControls";
import { Badge, leadStatusTone, leadHealthTone } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import type { Lead, LeadListFilters, LeadStatus } from "@/lib/services/leads";

const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "nurture", "registered", "closed"];
const PAGE_SIZE = 20;

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LeadImportPreviewResponse | null>(null);
  const [result, setResult] = useState<LeadImportCommitResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const res = await previewLeadImport(file);
    setBusy(false);
    if (res.success) setPreview(res.data);
    else setError(res.errors[0]?.message ?? "Could not read this file.");
  }

  async function handleCommit() {
    if (!file) return;
    setBusy(true);
    const res = await commitLeadImport(file);
    setBusy(false);
    if (res.success) {
      setResult(res.data);
      onImported();
    } else {
      setError(res.errors[0]?.message ?? "Import failed.");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "var(--adm-overlay)" }} onClick={onClose} />
      <div
        className="adm-animate-pop relative w-full max-w-lg overflow-hidden rounded-[var(--adm-radius-lg)] border shadow-2xl"
        style={{ background: "var(--adm-bg-elevated)", borderColor: "var(--adm-border-strong)" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--adm-border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Import Leads from CSV
          </p>
          <button type="button" onClick={onClose} className="adm-focus-ring adm-icon-btn">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          {!result && (
            <>
              <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                Expects columns for name, email, and phone (a program column is optional). Up to 5,000 rows.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                }}
                className="adm-input adm-focus-ring w-full py-1.5"
              />
              {error && (
                <p role="alert" className="text-sm" style={{ color: "var(--adm-danger)" }}>
                  {error}
                </p>
              )}
              {!preview && (
                <button type="button" onClick={handlePreview} disabled={!file || busy} className="adm-focus-ring adm-btn adm-btn-secondary">
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  Preview
                </button>
              )}
              {preview && (
                <div className="space-y-3">
                  <div className="adm-card p-3">
                    <p className="text-sm" style={{ color: "var(--adm-text)" }}>
                      <strong>{preview.validRowCount}</strong> rows ready to import
                      {preview.rejected.length > 0 && (
                        <span style={{ color: "var(--adm-warning)" }}> · {preview.rejected.length} rejected</span>
                      )}
                      {preview.truncated && <span style={{ color: "var(--adm-warning)" }}> · file truncated to 5,000 rows</span>}
                    </p>
                  </div>
                  {preview.rejected.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-[var(--adm-radius-md)] border p-2 text-xs" style={{ borderColor: "var(--adm-border)" }}>
                      {preview.rejected.slice(0, 20).map((r, i) => (
                        <p key={i} style={{ color: "var(--adm-text-muted)" }}>
                          Row {r.rowNumber}: {r.reason}
                        </p>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCommit}
                    disabled={busy || preview.validRowCount === 0}
                    className="adm-focus-ring adm-btn adm-btn-primary"
                  >
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    Import {preview.validRowCount} leads
                  </button>
                </div>
              )}
            </>
          )}
          {result && (
            <div className="adm-card p-3">
              <p className="text-sm" style={{ color: "var(--adm-text)" }}>
                Imported <strong>{result.imported}</strong>, {result.duplicates} already existed
                {result.rejected.length > 0 && `, ${result.rejected.length} rejected`}.
              </p>
              <button type="button" onClick={onClose} className="adm-focus-ring adm-btn adm-btn-secondary mt-3">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminLeadsPage() {
  const { user } = useAdminAuth();
  const isManagerOrAbove = user?.role === "manager" || user?.role === "admin";
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [source, setSource] = useState("");
  const [program, setProgram] = useState("");
  const [tagId, setTagId] = useState("");
  const [counsellorId, setCounsellorId] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const debouncedSearch = useDebouncedValue(searchInput);

  const { data: tagsData } = useAdminData(() => listTags(), []);
  const { data: staffData } = useAdminData(() => listStaff(), []);

  const filters: LeadListFilters = {
    search: debouncedSearch || undefined,
    status: status || undefined,
    source: source || undefined,
    program: program || undefined,
    tags: tagId ? [tagId] : undefined,
    assignedCounsellorId: counsellorId || undefined,
    archived: showArchived ? true : undefined,
  };

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listLeads(filters, page, PAGE_SIZE),
    [page, debouncedSearch, status, source, program, tagId, counsellorId, showArchived],
  );

  function onFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: "delete" | "archive" | "unarchive" | "assign", counsellorIdForAssign?: string) {
    if (selected.size === 0) return;
    if (action === "delete" && !window.confirm(`Delete ${selected.size} lead(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    await bulkLeadAction({ action, ids: Array.from(selected), counsellorId: counsellorIdForAssign });
    setBulkBusy(false);
    setSelected(new Set());
    reload();
  }

  const columns: TableColumn<Lead>[] = [
    ...(isManagerOrAbove
      ? [
          {
            key: "select",
            header: "",
            hideMobileLabel: true,
            render: (lead: Lead) => (
              <input
                type="checkbox"
                checked={selected.has(lead.id)}
                onChange={() => toggleSelected(lead.id)}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                aria-label={`Select ${lead.name}`}
                className="adm-focus-ring h-4 w-4"
              />
            ),
          } satisfies TableColumn<Lead>,
        ]
      : []),
    {
      key: "name",
      header: "Name",
      render: (lead) => (
        <Link href={`/admin/leads/${lead.id}`} className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--adm-text)" }}>
          {lead.name}
        </Link>
      ),
    },
    { key: "email", header: "Email", render: (lead) => lead.email },
    { key: "phone", header: "Phone", render: (lead) => lead.phone },
    { key: "program", header: "Program", render: (lead) => lead.program ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (lead) => <Badge tone={leadStatusTone(lead.status)}>{lead.status}</Badge>,
    },
    {
      key: "health",
      header: "Health",
      render: (lead) => <Badge tone={leadHealthTone(lead.health)}>{lead.health}</Badge>,
    },
    { key: "score", header: "Score", align: "right", render: (lead) => lead.score },
    { key: "createdAt", header: "Created", render: (lead) => new Date(lead.createdAt).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <div className="adm-animate-in flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="!text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
            Leads
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Search, filter, tag, assign, and export lead records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManagerOrAbove && (
            <>
              <Link href="/admin/leads/duplicates" className="adm-focus-ring adm-btn adm-btn-secondary">
                <GitMerge size={15} /> Duplicates
              </Link>
              <button type="button" onClick={() => setImportOpen(true)} className="adm-focus-ring adm-btn adm-btn-secondary">
                <Upload size={15} /> Import CSV
              </button>
            </>
          )}
          <a href={leadsCsvHref(filters)} className="adm-focus-ring adm-btn adm-btn-secondary">
            <Download size={15} /> Export CSV
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterInput
          label="Search leads by name, email, phone, or program"
          placeholder="Search name, email, phone, program…"
          value={searchInput}
          onChange={(event) => onFilterChange(setSearchInput)(event.target.value)}
          className="w-64"
        />
        <FilterSelect label="Filter by status" value={status} onChange={(event) => onFilterChange(setStatus)(event.target.value as LeadStatus | "")}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>
        <FilterInput label="Filter by source" placeholder="Source" value={source} onChange={(event) => onFilterChange(setSource)(event.target.value)} className="w-36" />
        <FilterInput label="Filter by program" placeholder="Program" value={program} onChange={(event) => onFilterChange(setProgram)(event.target.value)} className="w-36" />
        <FilterSelect label="Filter by tag" value={tagId} onChange={(event) => onFilterChange(setTagId)(event.target.value)} className="w-40">
          <option value="">All tags</option>
          {tagsData?.tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </FilterSelect>
        {isManagerOrAbove && (
          <FilterSelect label="Filter by counsellor" value={counsellorId} onChange={(event) => onFilterChange(setCounsellorId)(event.target.value)} className="w-44">
            <option value="">All counsellors</option>
            {staffData?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </FilterSelect>
        )}
        <label
          className="adm-input flex w-auto cursor-pointer items-center gap-2 text-sm"
          style={{ color: "var(--adm-text-secondary)" }}
        >
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => onFilterChange(setShowArchived)(event.target.checked)}
            className="adm-focus-ring"
          />
          Show archived
        </label>
      </div>

      {selected.size > 0 && (
        <div className="adm-card adm-animate-pop flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>
            {selected.size} selected
          </span>
          <FilterSelect
            label="Bulk assign to"
            value=""
            onChange={(e) => runBulk("assign", e.target.value)}
            className="w-48"
            disabled={bulkBusy}
          >
            <option value="">Assign to…</option>
            {staffData?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </FilterSelect>
          {showArchived ? (
            <button type="button" onClick={() => runBulk("unarchive")} disabled={bulkBusy} className="adm-focus-ring adm-btn adm-btn-secondary">
              Unarchive
            </button>
          ) : (
            <button type="button" onClick={() => runBulk("archive")} disabled={bulkBusy} className="adm-focus-ring adm-btn adm-btn-secondary">
              Archive
            </button>
          )}
          {user?.role === "admin" && (
            <button
              type="button"
              onClick={() => runBulk("delete")}
              disabled={bulkBusy}
              className="adm-focus-ring adm-btn adm-btn-secondary"
              style={{ color: "var(--adm-danger)" }}
            >
              Delete
            </button>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="adm-focus-ring adm-btn adm-btn-ghost">
            Clear
          </button>
        </div>
      )}

      {loading && <TableSkeleton rows={8} columns={columns.length} />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load leads."} onRetry={reload} />
      )}
      {!loading &&
        !forbidden &&
        !error &&
        data &&
        (data.items.length === 0 ? (
          <EmptyState message="No leads match these filters." />
        ) : (
          <div className="space-y-4">
            <Table columns={columns} rows={data.items} getRowKey={(lead) => lead.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}

      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={() => {
            reload();
          }}
        />
      )}
    </div>
  );
}
