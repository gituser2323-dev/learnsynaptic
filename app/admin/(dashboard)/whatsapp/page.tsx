"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import {
  listWhatsAppCampaigns,
  createWhatsAppCampaign,
  listCampaignTemplates,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { FilterInput, FilterSelect } from "@/components/admin/FilterControls";
import { FormField } from "@/components/admin/FormField";
import { Badge, whatsappCampaignStatusTone } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import type { CampaignRecurrenceRule, WhatsAppCampaign, WhatsAppCampaignStatus } from "@/lib/services/whatsappCampaigns";

const STATUS_OPTIONS: WhatsAppCampaignStatus[] = [
  "draft",
  "ready",
  "scheduled",
  "sending",
  "completed",
  "failed",
  "cancelled",
];
const RECURRENCE_FREQUENCIES: CampaignRecurrenceRule["frequency"][] = ["daily", "weekly", "monthly"];
const PAGE_SIZE = 20;

const COLUMNS: TableColumn<WhatsAppCampaign>[] = [
  {
    key: "name",
    header: "Name",
    render: (c) => (
      <div className="flex items-center gap-2">
        <Link href={`/admin/whatsapp/${c.id}`} className="font-medium hover:underline" style={{ color: "var(--adm-accent)" }}>
          {c.name}
        </Link>
        {c.recurrenceRule && (
          <span className="adm-chip text-[10px]" title={`Repeats every ${c.recurrenceRule.interval} ${c.recurrenceRule.frequency}`}>
            recurring
          </span>
        )}
      </div>
    ),
  },
  { key: "status", header: "Status", render: (c) => <Badge tone={whatsappCampaignStatusTone(c.status)}>{c.status}</Badge> },
  { key: "recipients", header: "Recipients", align: "right", render: (c) => c.recipientCount },
  { key: "sent", header: "Sent", align: "right", render: (c) => c.sentCount },
  { key: "delivered", header: "Delivered", align: "right", render: (c) => c.deliveredCount },
  { key: "read", header: "Read", align: "right", render: (c) => c.readCount },
  { key: "replies", header: "Replies", align: "right", render: (c) => c.replyCount },
  { key: "clicks", header: "Clicks", align: "right", render: (c) => c.clickCount },
  { key: "failed", header: "Failed", align: "right", render: (c) => c.failedCount },
  { key: "createdAt", header: "Created", render: (c) => new Date(c.createdAt).toLocaleDateString() },
];

/**
 * Minimal creation form — name + an existing CampaignTemplate. Audience
 * selection, scheduling, and sending all happen on the campaign detail
 * page once it exists (CAMPAIGN_ARCHITECTURE.md §1: a campaign starts
 * "draft" and moves through its lifecycle from there), so this form's
 * only job is getting a valid draft created.
 */
function CreateCampaignForm({ onCreated }: { onCreated: (campaignId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState<CampaignRecurrenceRule["frequency"]>("weekly");
  const [interval, setInterval] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: templatesData } = useAdminData(() => listCampaignTemplates({}, 1, 100), [open]);
  const templates = templatesData?.items ?? [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createWhatsAppCampaign({
      name,
      templateId,
      recurrenceRule: recurring ? { frequency, interval: Number(interval) || 1 } : undefined,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not create campaign.");
      return;
    }
    setName("");
    setTemplateId("");
    setRecurring(false);
    setOpen(false);
    onCreated(result.data.campaign.id);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
        style={{ background: "var(--adm-accent)" }}
      >
        <Plus size={15} /> New Campaign
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border p-4"
      style={{ borderColor: "var(--adm-border)", background: "var(--adm-surface)" }}
      noValidate
    >
      <FormField
        id="wa-campaign-name"
        label="Campaign Name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-64"
        placeholder="e.g. Cohort 4 — Welcome Blast"
      />
      <div>
        <label htmlFor="wa-campaign-template" className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
          Template
        </label>
        <select
          id="wa-campaign-template"
          required
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
          className="h-10 w-64 rounded-lg border px-3 text-sm outline-none transition focus:border-[var(--adm-accent)] focus:ring-4 focus:ring-blue-100"
          style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
        >
          <option value="">Select a template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="adm-focus-ring" />
          Recurring
        </label>
        {recurring && (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--adm-text-secondary)" }}>
              Every
            </span>
            <input
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="h-9 w-16 rounded-lg border px-2 text-sm outline-none"
              style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as CampaignRecurrenceRule["frequency"])}
              className="h-9 rounded-lg border px-2 text-sm outline-none"
              style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
            >
              {RECURRENCE_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-70"
        style={{ background: "var(--adm-accent)" }}
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        Create Draft
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-10 rounded-lg border px-4 text-sm font-medium"
        style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
      >
        Cancel
      </button>
      {templates.length === 0 && (
        <p className="w-full text-xs" style={{ color: "var(--adm-text-secondary)" }}>
          No templates yet — create one on the Templates page first.
        </p>
      )}
      {error && (
        <p role="alert" className="w-full text-sm font-medium" style={{ color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

export default function AdminWhatsAppCampaignsPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<WhatsAppCampaignStatus | "">("");
  const [showArchived, setShowArchived] = useState(false);
  const debouncedSearch = useDebouncedValue(searchInput);

  const filters = { search: debouncedSearch || undefined, status: status || undefined, archived: showArchived };

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listWhatsAppCampaigns(filters, page, PAGE_SIZE),
    [page, debouncedSearch, status, showArchived],
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
            WhatsApp Campaigns
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Bulk WhatsApp messaging — create, schedule, send, and track delivery.
          </p>
        </div>
        <CreateCampaignForm onCreated={(campaignId) => router.push(`/admin/whatsapp/${campaignId}`)} />
      </div>

      <div className="flex flex-wrap gap-3">
        <FilterInput
          label="Search campaigns by name"
          placeholder="Search name…"
          value={searchInput}
          onChange={(event) => onFilterChange(setSearchInput)(event.target.value)}
          className="w-64"
        />
        <FilterSelect
          label="Filter by status"
          value={status}
          onChange={(event) => onFilterChange(setStatus)(event.target.value as WhatsAppCampaignStatus | "")}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium" style={{ color: "var(--adm-text-secondary)" }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => onFilterChange(setShowArchived)(e.target.checked)}
            className="adm-focus-ring"
          />
          Show archived
        </label>
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
          <EmptyState message="No WhatsApp campaigns match these filters." />
        ) : (
          <div className="space-y-4">
            <Table columns={COLUMNS} rows={data.items} getRowKey={(c) => c.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}
    </div>
  );
}
