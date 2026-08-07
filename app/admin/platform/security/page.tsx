"use client";

import { useState } from "react";
import { useAdminData } from "@/components/admin/useAdminData";
import { listPlatformSecurityEvents } from "@/components/admin/apiClient";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingState, ErrorState, ForbiddenState, EmptyState } from "@/components/admin/DataStates";
import type { AuditLogEntry } from "@/lib/services/auditLog";

/**
 * RC-6 — cross-tenant security-event visibility, reusing RC-1/RC-2's
 * own security audit log. Deliberately not a full SIEM — a filtered,
 * paginated read, nothing more.
 */
export default function PlatformSecurityEventsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listPlatformSecurityEvents({ search: debouncedSearch || undefined }, page, 25),
    [debouncedSearch, page],
  );

  const columns: TableColumn<AuditLogEntry>[] = [
    { key: "action", header: "Action", render: (e) => <span style={{ color: "var(--adm-text)" }}>{e.action}</span> },
    { key: "entityId", header: "Entity", render: (e) => <span style={{ color: "var(--adm-text-muted)" }}>{e.entityType} · {e.entityId}</span> },
    { key: "org", header: "Organization", render: (e) => <span style={{ color: "var(--adm-text-muted)" }}>{e.organizationId ?? "—"}</span> },
    {
      key: "createdAt",
      header: "When",
      render: (e) => <span style={{ color: "var(--adm-text-muted)" }}>{new Date(e.createdAt).toLocaleString("en-IN")}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>
        Security Events
      </h1>

      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search by action or entity id…"
        className="adm-focus-ring w-full max-w-sm rounded-[var(--adm-radius-md)] px-3 py-2 text-sm"
        style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", color: "var(--adm-text)" }}
      />

      {loading ? (
        <LoadingState label="Loading security events…" />
      ) : forbidden ? (
        <ForbiddenState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.result.items.length === 0 ? (
        <EmptyState message="No security events match this filter." />
      ) : (
        <>
          <Table columns={columns} rows={data.result.items} getRowKey={(e) => e.id} />
          <Pagination page={data.result.page} totalPages={data.result.totalPages} total={data.result.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
