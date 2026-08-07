"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useAdminData } from "@/components/admin/useAdminData";
import { listPlatformOrganizations } from "@/components/admin/apiClient";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingState, ErrorState, ForbiddenState, EmptyState } from "@/components/admin/DataStates";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import type { Organization, OrganizationStatus } from "@/lib/services/organizations";

function statusTone(status: OrganizationStatus): BadgeTone {
  return status === "suspended" ? "danger" : "success";
}

/**
 * RC-6 — the platform console's own organization directory: search/
 * filter/paginate across every organization on the deployment. Never
 * exposes tenant secrets (§ RC-6 audit's own "secret management"
 * section) — this list is name/slug/status/dates only.
 */
export default function PlatformOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrganizationStatus | "">("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listPlatformOrganizations({ search: debouncedSearch || undefined, status: status || undefined }, page, 20),
    [debouncedSearch, status, page],
  );

  const columns: TableColumn<Organization>[] = [
    {
      key: "name",
      header: "Organization",
      render: (org) => (
        <Link href={`/admin/platform/organizations/${org.id}`} className="adm-focus-ring font-medium hover:underline" style={{ color: "var(--adm-text)" }}>
          {org.name}
        </Link>
      ),
    },
    { key: "slug", header: "Slug", render: (org) => <span style={{ color: "var(--adm-text-muted)" }}>{org.slug}</span> },
    { key: "status", header: "Status", render: (org) => <Badge tone={statusTone(org.status)}>{org.status}</Badge> },
    {
      key: "created",
      header: "Created",
      render: (org) => <span style={{ color: "var(--adm-text-muted)" }}>{new Date(org.createdAt).toLocaleDateString("en-IN")}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>
          Organizations
        </h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--adm-text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or slug…"
            className="adm-focus-ring w-full rounded-[var(--adm-radius-md)] py-2 pl-9 pr-3 text-sm"
            style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", color: "var(--adm-text)" }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrganizationStatus | "");
            setPage(1);
          }}
          className="adm-focus-ring rounded-[var(--adm-radius-md)] px-3 py-2 text-sm"
          style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", color: "var(--adm-text)" }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? (
        <LoadingState label="Loading organizations…" />
      ) : forbidden ? (
        <ForbiddenState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.result.items.length === 0 ? (
        <EmptyState message="No organizations match this filter." />
      ) : (
        <>
          <Table columns={columns} rows={data.result.items} getRowKey={(o) => o.id} />
          <Pagination page={data.result.page} totalPages={data.result.totalPages} total={data.result.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
