"use client";

import { useState } from "react";
import { RefreshCw, ListChecks, AlertTriangle, Clock, RotateCcw, XCircle, type LucideIcon } from "lucide-react";
import { listJobs, getJobMetrics, retryJob, cancelJob, runDueScheduledJobs, type AdminScheduledJob } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { FilterSelect, FilterInput } from "@/components/admin/FilterControls";
import { Badge, scheduledJobStatusTone } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { StatCard } from "@/components/admin/StatCard";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton, StatCardsSkeleton } from "@/components/admin/Skeleton";

/**
 * RC-3 — Reliability, Queues & Observability. The admin queue-health /
 * DLQ panel: queue depth, DLQ size, oldest-pending age, failure/retry
 * rate, a per-jobType failure breakdown, and a filterable, paginated
 * job table with safe retry/cancel actions — extends the existing
 * dashboard chrome (Table/Badge/StatCard/Pagination/FilterControls,
 * the exact components Audit Logs and every other list page already
 * use), never a redesign. "Run Due Jobs Now" reuses the same
 * runDueScheduledJobs() client call the Automation page's own button
 * already calls — one shared implementation, a second entry point that
 * makes sense on a page specifically about queue health.
 */

const STATUS_OPTIONS: AdminScheduledJob["status"][] = ["pending", "processing", "completed", "failed", "dead_lettered", "cancelled"];
const PAGE_SIZE = 25;

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function MetricsSummary({ reloadKey }: { reloadKey: number }) {
  const { data, loading } = useAdminData(() => getJobMetrics(), [reloadKey]);
  const m = data?.metrics;

  if (loading) return <StatCardsSkeleton count={5} />;
  if (!m) return null;

  const failedPlusDeadLettered = m.countsByStatus.failed + m.countsByStatus.dead_lettered;
  const terminalTotal = m.countsByStatus.completed + failedPlusDeadLettered;
  const failureRate = terminalTotal > 0 ? (failedPlusDeadLettered / terminalTotal) * 100 : null;
  const retryRate = failedPlusDeadLettered > 0 ? (m.retriedFailureCount / failedPlusDeadLettered) * 100 : null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Queue depth (pending)" value={m.countsByStatus.pending} icon={ListChecks as LucideIcon} tone="info" />
        <StatCard label="Dead-lettered (DLQ)" value={m.countsByStatus.dead_lettered} icon={AlertTriangle as LucideIcon} tone="danger" />
        <StatCard
          label="Oldest pending job"
          value={m.oldestPendingJobAgeSeconds !== null ? formatAge(m.oldestPendingJobAgeSeconds) : null}
          icon={Clock as LucideIcon}
          tone="warning"
        />
        <StatCard label="Failure rate" value={failureRate !== null ? `${failureRate.toFixed(1)}%` : null} tone="warning" />
        <StatCard label="Retry rate" value={retryRate !== null ? `${retryRate.toFixed(1)}%` : null} tone="accent" sublabel="of failed/dead-lettered jobs" />
      </div>

      {m.failuresByJobType.length > 0 && (
        <div className="adm-card mt-4 p-5">
          <h2 className="!text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Failures by job type
          </h2>
          <div className="mt-2">
            {m.failuresByJobType.map((row) => (
              <div
                key={row.jobType}
                className="flex items-center justify-between border-t py-2 text-sm first:border-t-0"
                style={{ borderColor: "var(--adm-border)" }}
              >
                <span style={{ color: "var(--adm-text)" }}>{row.jobType}</span>
                <span style={{ color: "var(--adm-text-muted)" }}>{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminReliabilityPage() {
  const { user } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AdminScheduledJob["status"] | "">("");
  const [jobTypeInput, setJobTypeInput] = useState("");
  const debouncedJobType = useDebouncedValue(jobTypeInput);
  const [runningNow, setRunningNow] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [metricsReloadKey, setMetricsReloadKey] = useState(0);

  const filters = { status: status || undefined, jobType: debouncedJobType || undefined };

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listJobs(filters, page, PAGE_SIZE),
    [page, status, debouncedJobType],
  );

  function onFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function reloadEverything() {
    reload();
    setMetricsReloadKey((k) => k + 1);
  }

  async function handleRunNow() {
    setRunningNow(true);
    setRunResult(null);
    const result = await runDueScheduledJobs();
    setRunningNow(false);
    if (result.success) {
      setRunResult(`Processed ${result.data.processed} due job(s).`);
      reloadEverything();
    }
  }

  async function handleRetry(id: string) {
    setActionError(null);
    const result = await retryJob(id);
    if (!result.success) {
      setActionError(result.errors[0]?.message ?? "Could not retry job.");
      return;
    }
    reloadEverything();
  }

  async function handleCancel(id: string) {
    setActionError(null);
    const result = await cancelJob(id);
    if (!result.success) {
      setActionError(result.errors[0]?.message ?? "Could not cancel job.");
      return;
    }
    reloadEverything();
  }

  const columns: TableColumn<AdminScheduledJob>[] = [
    { key: "jobType", header: "Job Type", render: (j) => j.jobType },
    { key: "status", header: "Status", render: (j) => <Badge tone={scheduledJobStatusTone(j.status)}>{j.status}</Badge> },
    { key: "attempts", header: "Attempts", render: (j) => j.attempts, align: "right" },
    { key: "runAt", header: "Run At", render: (j) => new Date(j.runAt).toLocaleString() },
    {
      key: "lastError",
      header: "Last Error",
      render: (j) =>
        j.lastError ? (
          <span className="line-clamp-1 max-w-xs" style={{ color: "var(--adm-danger)" }} title={j.lastError}>
            {j.lastError}
          </span>
        ) : (
          "—"
        ),
    },
    { key: "updatedAt", header: "Updated", render: (j) => new Date(j.updatedAt).toLocaleString() },
    {
      key: "actions",
      header: "Actions",
      hideMobileLabel: true,
      render: (j) => (
        <div className="flex gap-1.5">
          {(j.status === "dead_lettered" || j.status === "failed") && (
            <button type="button" onClick={() => handleRetry(j.id)} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
              <RotateCcw size={12} /> Retry
            </button>
          )}
          {j.status === "pending" && (
            <button type="button" onClick={() => handleCancel(j.id)} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
              <XCircle size={12} /> Cancel
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
            Reliability
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Background job queue health, dead-lettered jobs, and safe retry/cancel.
          </p>
        </div>
        <button type="button" onClick={handleRunNow} disabled={runningNow} className="adm-focus-ring adm-btn adm-btn-primary text-sm">
          <RefreshCw size={14} className={runningNow ? "animate-spin" : undefined} />
          Run Due Jobs Now
        </button>
      </div>

      {runResult && (
        <p className="text-sm" style={{ color: "var(--adm-success)" }}>
          {runResult}
        </p>
      )}
      {actionError && (
        <p className="text-sm" style={{ color: "var(--adm-danger)" }}>
          {actionError}
        </p>
      )}

      <MetricsSummary reloadKey={metricsReloadKey} />

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label="Filter by status"
          value={status}
          onChange={(event) => onFilterChange(setStatus)(event.target.value as AdminScheduledJob["status"] | "")}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>
        <FilterInput
          label="Filter by job type"
          placeholder="e.g. whatsapp.send_message"
          value={jobTypeInput}
          onChange={(event) => onFilterChange(setJobTypeInput)(event.target.value)}
          className="w-64"
        />
      </div>

      {loading && <TableSkeleton rows={10} columns={7} />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && <ErrorState message={error ?? "Could not load jobs."} onRetry={reload} />}
      {!loading &&
        !forbidden &&
        !error &&
        data &&
        (data.items.length === 0 ? (
          <EmptyState message="No jobs match these filters." />
        ) : (
          <div className="space-y-4">
            <Table columns={columns} rows={data.items} getRowKey={(j) => j.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}
    </div>
  );
}
