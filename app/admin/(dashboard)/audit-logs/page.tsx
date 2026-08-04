"use client";

import { useState } from "react";
import { listAuditLogs } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { FilterInput, FilterSelect } from "@/components/admin/FilterControls";
import { Badge, auditCategoryTone } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import type { AuditLogEntry, AuditCategory, AuditEntityType } from "@/lib/services/auditLog";

const CATEGORY_OPTIONS: AuditCategory[] = ["business", "security"];
const ENTITY_TYPE_OPTIONS: AuditEntityType[] = ["Lead", "Campaign", "Registration", "User", "WhatsAppCampaign"];
const PAGE_SIZE = 25;

const COLUMNS: TableColumn<AuditLogEntry>[] = [
  { key: "action", header: "Action", render: (e) => e.action },
  { key: "category", header: "Category", render: (e) => <Badge tone={auditCategoryTone(e.category)}>{e.category}</Badge> },
  { key: "entity", header: "Entity", render: (e) => `${e.entityType} · ${e.entityId}` },
  { key: "actor", header: "Actor", render: (e) => `${e.actorType}${e.actorId ? ` · ${e.actorId}` : ""}` },
  { key: "createdAt", header: "When", render: (e) => new Date(e.createdAt).toLocaleString() },
];

export default function AdminAuditLogsPage() {
  const { user } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState<AuditCategory | "">("");
  const [entityType, setEntityType] = useState<AuditEntityType | "">("");
  const [action, setAction] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput);

  const filters = {
    search: debouncedSearch || undefined,
    category: category || undefined,
    entityType: entityType || undefined,
    action: action || undefined,
  };

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listAuditLogs(filters, page, PAGE_SIZE),
    [page, debouncedSearch, category, entityType, action],
  );

  function onFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
          Audit Logs
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
          Every recorded business audit event — filterable, read-only.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterInput
          label="Search audit logs by entity ID or action"
          placeholder="Search entity ID or action…"
          value={searchInput}
          onChange={(event) => onFilterChange(setSearchInput)(event.target.value)}
          className="w-64"
        />
        <FilterSelect
          label="Filter by category"
          value={category}
          onChange={(event) => onFilterChange(setCategory)(event.target.value as AuditCategory | "")}
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Filter by entity type"
          value={entityType}
          onChange={(event) => onFilterChange(setEntityType)(event.target.value as AuditEntityType | "")}
        >
          <option value="">All entity types</option>
          {ENTITY_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>
        <FilterInput
          label="Filter by exact action"
          placeholder="Exact action, e.g. lead.created"
          value={action}
          onChange={(event) => onFilterChange(setAction)(event.target.value)}
          className="w-56"
        />
      </div>

      {loading && <TableSkeleton rows={10} columns={COLUMNS.length} />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load audit logs."} onRetry={reload} />
      )}
      {!loading &&
        !forbidden &&
        !error &&
        data &&
        (data.items.length === 0 ? (
          <EmptyState message="No audit log entries match these filters." />
        ) : (
          <div className="space-y-4">
            <Table columns={COLUMNS} rows={data.items} getRowKey={(e) => e.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}
    </div>
  );
}
