"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  getWhatsAppCampaign,
  resolveWhatsAppCampaignAudience,
  importWhatsAppCampaignCsv,
  sendWhatsAppCampaignNow,
  scheduleWhatsAppCampaign,
  cancelWhatsAppCampaign,
  retryFailedWhatsAppMessages,
  listWhatsAppCampaignMessages,
  archiveWhatsAppCampaign,
  unarchiveWhatsAppCampaign,
  cloneWhatsAppCampaign,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { FormField } from "@/components/admin/FormField";
import { FilterSelect } from "@/components/admin/FilterControls";
import { StatCard } from "@/components/admin/StatCard";
import { Badge, whatsappCampaignStatusTone, messageStatusTone } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { StatCardsSkeleton, TableSkeleton } from "@/components/admin/Skeleton";
import type { Message, MessageStatus } from "@/lib/services/whatsappCampaigns";

const MESSAGE_STATUS_OPTIONS: MessageStatus[] = ["queued", "sending", "sent", "delivered", "read", "failed"];
const MESSAGES_PAGE_SIZE = 20;

const MESSAGE_COLUMNS: TableColumn<Message>[] = [
  { key: "phone", header: "Phone", render: (m) => m.recipientPhoneE164 },
  { key: "name", header: "Name", render: (m) => m.recipientName ?? "—" },
  { key: "status", header: "Status", render: (m) => <Badge tone={messageStatusTone(m.status)}>{m.status}</Badge> },
  { key: "attempts", header: "Attempts", align: "right", render: (m) => m.attempts },
  { key: "failureReason", header: "Failure Reason", render: (m) => m.failureReason ?? "—" },
  {
    key: "updatedAt",
    header: "Last Updated",
    render: (m) => new Date(m.updatedAt).toLocaleString(),
  },
];

type AudienceTab = "filter" | "manual" | "csv";

/** Only rendered while the campaign is still "draft" — resolving an
 *  audience is a one-time snapshot (CAMPAIGN_ARCHITECTURE.md §5), so
 *  once it's done the campaign moves to "ready" and this section
 *  disappears in favor of the send/schedule actions. */
function ResolveAudienceSection({ campaignId, onResolved }: { campaignId: string; onResolved: () => void }) {
  const [tab, setTab] = useState<AudienceTab>("filter");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [leadStatus, setLeadStatus] = useState("");
  const [program, setProgram] = useState("");
  const [search, setSearch] = useState("");

  const [manualRecipients, setManualRecipients] = useState("");

  async function handleFilterSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await resolveWhatsAppCampaignAudience(campaignId, {
      source: "filter",
      leadFilters: {
        status: (leadStatus || undefined) as never,
        program: program || undefined,
        search: search || undefined,
      },
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not resolve audience.");
      return;
    }
    setNotice(`Resolved ${result.data.resolution.recipientCount} recipients (${result.data.resolution.rejected.length} rejected).`);
    onResolved();
  }

  async function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const recipients = manualRecipients
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [phoneE164, name] = line.split(",").map((part) => part.trim());
        return { phoneE164, name: name || undefined };
      });

    const result = await resolveWhatsAppCampaignAudience(campaignId, { source: "manual", recipients });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not resolve audience.");
      return;
    }
    setNotice(`Resolved ${result.data.resolution.recipientCount} recipients (${result.data.resolution.rejected.length} rejected).`);
    onResolved();
  }

  async function handleCsvSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fileInput = event.currentTarget.elements.namedItem("csvFile") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await importWhatsAppCampaignCsv(campaignId, file);
    setSubmitting(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not import CSV.");
      return;
    }
    setNotice(
      `Imported ${result.data.importResult.recipients.length} recipients (${result.data.importResult.rejected.length} rejected)${result.data.importResult.truncated ? " — file was truncated to the row cap" : ""}.`,
    );
    onResolved();
  }

  return (
    <section
      className="space-y-4 rounded-2xl border p-5"
      style={{ borderColor: "var(--adm-border)", background: "var(--adm-surface)" }}
    >
      <div>
        <h2 className="!text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
          Resolve Audience
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
          Choose recipients once — a filter on Leads, a manual list, or a CSV import. This snapshots the audience
          into the campaign; it can&apos;t be re-run live.
        </p>
      </div>

      <div className="flex gap-2" role="group" aria-label="Audience source">
        {(["filter", "manual", "csv"] as AudienceTab[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={tab === option}
            onClick={() => setTab(option)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition"
            style={
              tab === option
                ? { background: "var(--adm-accent-soft)", color: "var(--adm-accent)" }
                : { color: "var(--adm-text-secondary)" }
            }
          >
            {option === "csv" ? "CSV Import" : option}
          </button>
        ))}
      </div>

      {tab === "filter" && (
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-3" noValidate>
          <FilterSelect label="Lead status" value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="new">new</option>
            <option value="contacted">contacted</option>
            <option value="nurture">nurture</option>
            <option value="registered">registered</option>
            <option value="closed">closed</option>
          </FilterSelect>
          <FormField id="wa-audience-program" label="Program" value={program} onChange={(e) => setProgram(e.target.value)} className="w-48" />
          <FormField id="wa-audience-search" label="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-70"
            style={{ background: "var(--adm-accent)" }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Resolve from Leads
          </button>
        </form>
      )}

      {tab === "manual" && (
        <form onSubmit={handleManualSubmit} className="space-y-3" noValidate>
          <div>
            <label htmlFor="wa-manual-recipients" className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
              Recipients — one per line, &quot;+91XXXXXXXXXX, Name&quot; (name optional)
            </label>
            <textarea
              id="wa-manual-recipients"
              required
              rows={5}
              value={manualRecipients}
              onChange={(e) => setManualRecipients(e.target.value)}
              className="w-full rounded-lg border p-3 text-sm outline-none transition focus:border-[var(--adm-accent)] focus:ring-4 focus:ring-blue-100"
              style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
              placeholder={"+919876543210, Priya\n+919876543211"}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-70"
            style={{ background: "var(--adm-accent)" }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Resolve Manual List
          </button>
        </form>
      )}

      {tab === "csv" && (
        <form onSubmit={handleCsvSubmit} className="flex flex-wrap items-end gap-3" noValidate>
          <div>
            <label htmlFor="wa-csv-file" className="mb-1 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
              CSV file (needs a phone column)
            </label>
            <input
              id="wa-csv-file"
              name="csvFile"
              type="file"
              accept=".csv,text/csv"
              required
              className="text-sm"
              style={{ color: "var(--adm-text)" }}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-70"
            style={{ background: "var(--adm-accent)" }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Import CSV
          </button>
        </form>
      )}

      {notice && <p className="text-xs" style={{ color: "var(--adm-text-secondary)" }}>{notice}</p>}
      {error && (
        <p role="alert" className="text-sm font-medium" style={{ color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
    </section>
  );
}

function LifecycleActions({
  campaignId,
  status,
  failedCount,
  archived,
  onChanged,
}: {
  campaignId: string;
  status: string;
  failedCount: number;
  archived: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");

  async function run(action: string, fn: () => Promise<{ success: boolean; errors?: { message: string }[] }>) {
    setBusy(action);
    setError(null);
    const result = await fn();
    setBusy(null);
    if (!result.success) {
      setError(result.errors?.[0]?.message ?? "Action failed.");
      return;
    }
    onChanged();
  }

  async function handleClone() {
    setBusy("clone");
    setError(null);
    const result = await cloneWhatsAppCampaign(campaignId);
    setBusy(null);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not duplicate campaign.");
      return;
    }
    router.push(`/admin/whatsapp/${result.data.campaign.id}`);
  }

  const canSendOrSchedule = status === "ready";
  const canCancel = status === "ready" || status === "scheduled" || status === "sending";
  const canRetry = failedCount > 0;

  return (
    <section
      className="space-y-3 rounded-2xl border p-5"
      style={{ borderColor: "var(--adm-border)", background: "var(--adm-surface)" }}
    >
      <h2 className="!text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
        Actions
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        {canSendOrSchedule && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("send", () => sendWhatsAppCampaignNow(campaignId))}
            className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-70"
            style={{ background: "var(--adm-accent)" }}
          >
            {busy === "send" && <Loader2 size={14} className="animate-spin" />}
            Send Now
          </button>
        )}
        {canSendOrSchedule && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!scheduledFor) return;
              run("schedule", () => scheduleWhatsAppCampaign(campaignId, new Date(scheduledFor).toISOString()));
            }}
            className="flex items-end gap-2"
          >
            <FormField
              id="wa-schedule-for"
              label="Schedule for"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy !== null || !scheduledFor}
              className="h-10 rounded-lg border px-4 text-sm font-medium transition disabled:opacity-50"
              style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
            >
              {busy === "schedule" && <Loader2 size={14} className="mr-2 inline animate-spin" />}
              Schedule
            </button>
          </form>
        )}
        {canCancel && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("cancel", () => cancelWhatsAppCampaign(campaignId))}
            className="adm-focus-ring h-10 rounded-[var(--adm-radius-md)] border px-4 text-sm font-medium transition disabled:opacity-50"
            style={{ borderColor: "var(--adm-border)", color: "var(--adm-danger)" }}
          >
            {busy === "cancel" && <Loader2 size={14} className="mr-2 inline animate-spin" />}
            Cancel Campaign
          </button>
        )}
        {canRetry && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("retry", () => retryFailedWhatsAppMessages(campaignId))}
            className="h-10 rounded-lg border px-4 text-sm font-medium transition disabled:opacity-50"
            style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
          >
            {busy === "retry" && <Loader2 size={14} className="mr-2 inline animate-spin" />}
            Retry Failed ({failedCount})
          </button>
        )}
        {/* Module 2.5 — Duplicate/Archive: always available, no status
         *  restriction. Duplicate never reads this campaign's Message
         *  rows (see cloneCampaign's own doc comment); Archive is purely
         *  a Campaign History visibility toggle. */}
        <button
          type="button"
          disabled={busy !== null}
          onClick={handleClone}
          className="h-10 rounded-lg border px-4 text-sm font-medium transition disabled:opacity-50"
          style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
        >
          {busy === "clone" && <Loader2 size={14} className="mr-2 inline animate-spin" />}
          Duplicate
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run(
              "archive",
              () => (archived ? unarchiveWhatsAppCampaign(campaignId) : archiveWhatsAppCampaign(campaignId)),
            )
          }
          className="h-10 rounded-lg border px-4 text-sm font-medium transition disabled:opacity-50"
          style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
        >
          {busy === "archive" && <Loader2 size={14} className="mr-2 inline animate-spin" />}
          {archived ? "Unarchive" : "Archive"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium" style={{ color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
    </section>
  );
}

function MessagesSection({ campaignId }: { campaignId: string }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<MessageStatus | "">("");

  const { data, loading, error, reload } = useAdminData(
    () => listWhatsAppCampaignMessages(campaignId, { status: status || undefined }, page, MESSAGES_PAGE_SIZE),
    [campaignId, status, page],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="!text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
          Messages
        </h2>
        <FilterSelect
          label="Filter messages by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MessageStatus | "");
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {MESSAGE_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </FilterSelect>
      </div>

      {loading && <TableSkeleton rows={6} columns={MESSAGE_COLUMNS.length} />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading &&
        !error &&
        data &&
        (data.items.length === 0 ? (
          <EmptyState message="No messages match this filter." />
        ) : (
          <div className="space-y-4">
            <Table columns={MESSAGE_COLUMNS} rows={data.items} getRowKey={(m) => m.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}
    </section>
  );
}

export default function AdminWhatsAppCampaignDetailPage() {
  const { user } = useAdminAuth();
  const params = useParams<{ id: string }>();
  const campaignId = params.id;

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => getWhatsAppCampaign(campaignId),
    [campaignId],
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/whatsapp"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: "var(--adm-text-secondary)" }}
      >
        <ArrowLeft size={14} /> Back to WhatsApp Campaigns
      </Link>

      {loading && (
        <div className="space-y-6">
          <StatCardsSkeleton count={5} />
          <TableSkeleton rows={6} columns={6} />
        </div>
      )}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load campaign."} onRetry={reload} />
      )}
      {!loading && !forbidden && !error && data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
              {data.campaign.name}
            </h1>
            <Badge tone={whatsappCampaignStatusTone(data.campaign.status)}>{data.campaign.status}</Badge>
            {data.campaign.archived && <Badge tone="neutral">archived</Badge>}
            {data.campaign.recurrenceRule && (
              <span className="text-xs" style={{ color: "var(--adm-text-secondary)" }}>
                Repeats every {data.campaign.recurrenceRule.interval} {data.campaign.recurrenceRule.frequency}
              </span>
            )}
          </div>
          {data.campaign.lastError && (
            <p role="alert" className="text-sm font-medium" style={{ color: "var(--adm-danger)" }}>
              {data.campaign.lastError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
            <StatCard label="Recipients" value={data.campaign.recipientCount} />
            <StatCard label="Queued" value={data.messageCounts.queued} />
            <StatCard label="Sent" value={data.messageCounts.sent} />
            <StatCard label="Delivered" value={data.messageCounts.delivered} />
            <StatCard label="Replies" value={data.campaign.replyCount} />
            <StatCard label="Clicks" value={data.campaign.clickCount} />
            <StatCard label="Failed" value={data.messageCounts.failed} />
          </div>

          {data.campaign.status === "draft" && (
            <ResolveAudienceSection campaignId={campaignId} onResolved={reload} />
          )}

          <LifecycleActions
            campaignId={campaignId}
            status={data.campaign.status}
            failedCount={data.messageCounts.failed}
            archived={data.campaign.archived}
            onChanged={reload}
          />

          <MessagesSection campaignId={campaignId} />
        </>
      )}
    </div>
  );
}
