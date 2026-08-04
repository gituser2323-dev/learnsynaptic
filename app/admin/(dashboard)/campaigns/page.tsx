"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { listCampaigns, campaignsCsvHref } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { FilterInput, FilterSelect } from "@/components/admin/FilterControls";
import { Badge, campaignStatusTone } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import type { Campaign, CampaignChannel, CampaignListFilters, CampaignStatus } from "@/lib/services/campaigns";

const STATUS_OPTIONS: CampaignStatus[] = ["draft", "active", "paused", "ended"];
const CHANNEL_OPTIONS: CampaignChannel[] = ["meta", "google", "organic", "referral", "email", "other"];
const PAGE_SIZE = 20;

function formatDate(value: string | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

const COLUMNS: TableColumn<Campaign>[] = [
  { key: "name", header: "Name", render: (campaign) => campaign.name },
  { key: "code", header: "Code", render: (campaign) => campaign.code },
  { key: "channel", header: "Channel", render: (campaign) => campaign.channel },
  {
    key: "status",
    header: "Status",
    render: (campaign) => <Badge tone={campaignStatusTone(campaign.status)}>{campaign.status}</Badge>,
  },
  { key: "registrations", header: "Registrations", align: "right", render: (campaign) => campaign.registrationCount },
  { key: "startDate", header: "Start Date", render: (campaign) => formatDate(campaign.startDate) },
  { key: "endDate", header: "End Date", render: (campaign) => formatDate(campaign.endDate) },
];

export default function AdminCampaignsPage() {
  const { user } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "">("");
  const [channel, setChannel] = useState<CampaignChannel | "">("");
  const debouncedSearch = useDebouncedValue(searchInput);

  const filters: CampaignListFilters = {
    search: debouncedSearch || undefined,
    status: status || undefined,
    channel: channel || undefined,
  };

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listCampaigns(filters, page, PAGE_SIZE),
    [page, debouncedSearch, status, channel],
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
            Campaigns
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Every campaign — not just active — with registration counts.
          </p>
        </div>
        <a
          href={campaignsCsvHref(filters)}
          className="adm-focus-ring adm-btn adm-btn-secondary"
        >
          <Download size={15} /> Export CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterInput
          label="Search campaigns by name or code"
          placeholder="Search name or code…"
          value={searchInput}
          onChange={(event) => onFilterChange(setSearchInput)(event.target.value)}
          className="w-64"
        />
        <FilterSelect
          label="Filter by status"
          value={status}
          onChange={(event) => onFilterChange(setStatus)(event.target.value as CampaignStatus | "")}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Filter by channel"
          value={channel}
          onChange={(event) => onFilterChange(setChannel)(event.target.value as CampaignChannel | "")}
        >
          <option value="">All channels</option>
          {CHANNEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>
      </div>

      {loading && <TableSkeleton rows={8} columns={COLUMNS.length} />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load campaigns."} onRetry={reload} />
      )}
      {!loading &&
        !forbidden &&
        !error &&
        data &&
        (data.items.length === 0 ? (
          <EmptyState message="No campaigns match these filters." />
        ) : (
          <div className="space-y-4">
            <Table columns={COLUMNS} rows={data.items} getRowKey={(campaign) => campaign.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}
    </div>
  );
}
