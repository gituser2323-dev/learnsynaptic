"use client";

import { useState } from "react";
import { listLeads } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { FilterInput } from "@/components/admin/FilterControls";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import type { Lead } from "@/lib/services/leads";

const PAGE_SIZE = 20;

/**
 * Contact directory — the same Lead records the Leads page manages, just
 * a simpler read-oriented column set and no status/source/program
 * filters (that lifecycle detail lives on the Leads page). Deliberately
 * reuses listLeads() rather than a new endpoint: "Contacts" has no
 * distinct backend concept of its own, it's a different lens on the
 * same data.
 */
const COLUMNS: TableColumn<Lead>[] = [
  { key: "name", header: "Name", render: (lead) => lead.name },
  { key: "email", header: "Email", render: (lead) => lead.email },
  { key: "phone", header: "Phone", render: (lead) => lead.phone },
  { key: "program", header: "Program", render: (lead) => lead.program ?? "—" },
  { key: "createdAt", header: "Added", render: (lead) => new Date(lead.createdAt).toLocaleDateString() },
];

export default function AdminContactsPage() {
  const { user } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listLeads({ search: debouncedSearch || undefined }, page, PAGE_SIZE),
    [page, debouncedSearch],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
          Contacts
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
          Every lead as a contact directory. For status/source/program filtering and CSV export, use the Leads page.
        </p>
      </div>

      <FilterInput
        label="Search contacts by name, email, or phone"
        placeholder="Search name, email, phone…"
        value={searchInput}
        onChange={(event) => {
          setSearchInput(event.target.value);
          setPage(1);
        }}
        className="w-64"
      />

      {loading && <TableSkeleton rows={8} columns={COLUMNS.length} />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load contacts."} onRetry={reload} />
      )}
      {!loading &&
        !forbidden &&
        !error &&
        data &&
        (data.items.length === 0 ? (
          <EmptyState message="No contacts match this search." />
        ) : (
          <div className="space-y-4">
            <Table columns={COLUMNS} rows={data.items} getRowKey={(lead) => lead.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}
    </div>
  );
}
