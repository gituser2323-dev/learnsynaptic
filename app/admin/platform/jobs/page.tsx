"use client";

import { useState } from "react";
import { RotateCcw, XCircle } from "lucide-react";
import { useAdminData } from "@/components/admin/useAdminData";
import { listPlatformJobs, retryPlatformJob, cancelPlatformJob, type AdminScheduledJob } from "@/components/admin/apiClient";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingState, ErrorState, ForbiddenState, EmptyState } from "@/components/admin/DataStates";
import { Badge, type BadgeTone } from "@/components/admin/Badge";

function statusTone(status: AdminScheduledJob["status"]): BadgeTone {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
    case "dead_lettered":
      return "danger";
    case "processing":
      return "info";
    case "cancelled":
      return "neutral";
    default:
      return "warning";
  }
}

/**
 * RC-6 — cross-tenant queue/DLQ visibility, reusing RC-3's scheduler.
 * Retry refuses (with the real reason shown inline) for job types RC-5
 * classified MUST NOT REPLAY AUTOMATICALLY — see
 * platformJobOpsService's own doc comment. Never a blind retry button.
 */
export default function PlatformJobsPage() {
  const [status, setStatus] = useState<AdminScheduledJob["status"] | "">("dead_lettered");
  const [page, setPage] = useState(1);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listPlatformJobs({ status: status || undefined }, page, 20),
    [status, page],
  );

  async function handleRetry(id: string) {
    setActionMessage(null);
    // The route surfaces a replay-safety refusal (RC-5's own
    // classification) as a real 403 with the reason as the message —
    // never a silent no-op — so both "not found/not retryable" and
    // "refused for safety" land in the same result.errors branch here.
    const result = await retryPlatformJob(id);
    if (!result.success) {
      setActionMessage(result.errors[0]?.message ?? "Retry failed.");
      return;
    }
    reload();
  }

  async function handleCancel(id: string) {
    setActionMessage(null);
    const result = await cancelPlatformJob(id);
    if (!result.success) {
      setActionMessage(result.errors[0]?.message ?? "Cancel failed.");
      return;
    }
    reload();
  }

  const columns: TableColumn<AdminScheduledJob>[] = [
    { key: "jobType", header: "Job Type", render: (j) => <span style={{ color: "var(--adm-text)" }}>{j.jobType}</span> },
    { key: "status", header: "Status", render: (j) => <Badge tone={statusTone(j.status)}>{j.status}</Badge> },
    { key: "org", header: "Organization", render: (j) => <span style={{ color: "var(--adm-text-muted)" }}>{j.organizationId ?? "(system)"}</span> },
    { key: "attempts", header: "Attempts", align: "right", render: (j) => j.attempts },
    {
      key: "error",
      header: "Last Error",
      render: (j) => (
        <span className="line-clamp-1 max-w-xs text-xs" style={{ color: "var(--adm-danger)" }}>
          {j.lastError ?? "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (j) => (
        <div className="flex justify-end gap-2">
          {(j.status === "failed" || j.status === "dead_lettered") && (
            <button type="button" onClick={() => handleRetry(j.id)} className="adm-focus-ring adm-btn adm-btn-secondary" title="Retry">
              <RotateCcw size={13} />
            </button>
          )}
          {j.status === "pending" && (
            <button type="button" onClick={() => handleCancel(j.id)} className="adm-focus-ring adm-btn adm-btn-secondary" title="Cancel">
              <XCircle size={13} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>
        Jobs &amp; Queue
      </h1>

      {actionMessage && <ErrorState message={actionMessage} />}

      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value as AdminScheduledJob["status"] | "");
          setPage(1);
        }}
        className="adm-focus-ring rounded-[var(--adm-radius-md)] px-3 py-2 text-sm"
        style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", color: "var(--adm-text)" }}
      >
        <option value="">All statuses</option>
        <option value="dead_lettered">Dead-lettered</option>
        <option value="failed">Failed</option>
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>

      {loading ? (
        <LoadingState label="Loading jobs…" />
      ) : forbidden ? (
        <ForbiddenState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.result.items.length === 0 ? (
        <EmptyState message="No jobs match this filter." />
      ) : (
        <>
          <Table columns={columns} rows={data.result.items} getRowKey={(j) => j.id} />
          <Pagination page={data.result.page} totalPages={data.result.totalPages} total={data.result.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
