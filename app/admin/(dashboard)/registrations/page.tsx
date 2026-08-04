"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { listRegistrations, registrationsCsvHref } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { FilterInput, FilterSelect } from "@/components/admin/FilterControls";
import { Badge, registrationStatusTone } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import type { Registration, RegistrationListFilters, RegistrationStatus } from "@/lib/services/registrations";

const STATUS_OPTIONS: RegistrationStatus[] = ["pending", "confirmed", "cancelled"];
const PAGE_SIZE = 20;

const COLUMNS: TableColumn<Registration>[] = [
  { key: "leadId", header: "Lead ID", render: (registration) => registration.leadId },
  {
    key: "program",
    header: "Program",
    render: (registration) => registration.programName ?? registration.programSlug,
  },
  {
    key: "status",
    header: "Status",
    render: (registration) => <Badge tone={registrationStatusTone(registration.status)}>{registration.status}</Badge>,
  },
  { key: "source", header: "Source", render: (registration) => registration.source },
  { key: "campaignId", header: "Campaign ID", render: (registration) => registration.campaignId ?? "—" },
  { key: "createdAt", header: "Created", render: (registration) => new Date(registration.createdAt).toLocaleDateString() },
];

export default function AdminRegistrationsPage() {
  const { user } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RegistrationStatus | "">("");
  const [programSlug, setProgramSlug] = useState("");
  const [campaignId, setCampaignId] = useState("");

  const filters: RegistrationListFilters = {
    status: status || undefined,
    programSlug: programSlug || undefined,
    campaignId: campaignId || undefined,
  };

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listRegistrations(filters, page, PAGE_SIZE),
    [page, status, programSlug, campaignId],
  );

  function onFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
            Registrations
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Filtered, paginated registration listing. Aggregate analytics live on the Overview page.
          </p>
        </div>
        <a
          href={registrationsCsvHref(filters)}
          className="adm-focus-ring adm-btn adm-btn-secondary"
        >
          <Download size={15} /> Export CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterSelect
          label="Filter by status"
          value={status}
          onChange={(event) => onFilterChange(setStatus)(event.target.value as RegistrationStatus | "")}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>
        <FilterInput
          label="Filter by program slug"
          placeholder="Program slug"
          value={programSlug}
          onChange={(event) => onFilterChange(setProgramSlug)(event.target.value)}
          className="w-48"
        />
        <FilterInput
          label="Filter by campaign ID"
          placeholder="Campaign ID"
          value={campaignId}
          onChange={(event) => onFilterChange(setCampaignId)(event.target.value)}
          className="w-56"
        />
      </div>

      {loading && <TableSkeleton rows={8} columns={COLUMNS.length} />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load registrations."} onRetry={reload} />
      )}
      {!loading &&
        !forbidden &&
        !error &&
        data &&
        (data.items.length === 0 ? (
          <EmptyState message="No registrations match these filters." />
        ) : (
          <div className="space-y-4">
            <Table columns={COLUMNS} rows={data.items} getRowKey={(registration) => registration.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}
    </div>
  );
}
