"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { listCampaignTemplates, createCampaignTemplate } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { FilterInput } from "@/components/admin/FilterControls";
import { FormField } from "@/components/admin/FormField";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import type { CampaignTemplate, TemplateApprovalStatus } from "@/lib/services/whatsappCampaigns";

const PAGE_SIZE = 20;

/** Module 2.3 — "unknown" means the sync job hasn't checked this
 *  template yet (or no vendor is configured to check it), distinct
 *  from "pending" (checked, and the vendor is actively reviewing it). */
const APPROVAL_TONE: Record<TemplateApprovalStatus, BadgeTone> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  unknown: "neutral",
};

const COLUMNS: TableColumn<CampaignTemplate>[] = [
  { key: "name", header: "Name", render: (t) => t.name },
  { key: "metaTemplateName", header: "Meta Template Name", render: (t) => t.metaTemplateName },
  { key: "languageCode", header: "Language", render: (t) => t.languageCode },
  {
    key: "approvalStatus",
    header: "Approval",
    render: (t) => <Badge tone={APPROVAL_TONE[t.approvalStatus]}>{t.approvalStatus}</Badge>,
  },
  {
    key: "variables",
    header: "Variables",
    render: (t) => (t.variableLabels.length > 0 ? t.variableLabels.join(", ") : "—"),
  },
  { key: "createdAt", header: "Created", render: (t) => new Date(t.createdAt).toLocaleDateString() },
];

function CreateTemplateForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [metaTemplateName, setMetaTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("en_US");
  const [variableLabels, setVariableLabels] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createCampaignTemplate({
      name,
      metaTemplateName,
      languageCode,
      variableLabels: variableLabels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not create template.");
      return;
    }
    setName("");
    setMetaTemplateName("");
    setLanguageCode("en_US");
    setVariableLabels("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
        style={{ background: "var(--adm-accent)" }}
      >
        <Plus size={15} /> New Template
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
        id="tpl-name"
        label="Display Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-52"
        placeholder="e.g. Cohort Welcome"
      />
      <FormField
        id="tpl-meta-name"
        label="Meta Template Name"
        required
        value={metaTemplateName}
        onChange={(e) => setMetaTemplateName(e.target.value)}
        className="w-52"
        placeholder="Exact name approved in Meta"
      />
      <FormField
        id="tpl-language"
        label="Language Code"
        required
        value={languageCode}
        onChange={(e) => setLanguageCode(e.target.value)}
        className="w-32"
        placeholder="en_US"
      />
      <FormField
        id="tpl-variables"
        label="Variables (comma-separated)"
        value={variableLabels}
        onChange={(e) => setVariableLabels(e.target.value)}
        className="w-64"
        placeholder="first_name, program_name"
      />
      <button
        type="submit"
        disabled={submitting}
        className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-70"
        style={{ background: "var(--adm-accent)" }}
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        Create Template
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-10 rounded-lg border px-4 text-sm font-medium"
        style={{ borderColor: "var(--adm-border)", color: "var(--adm-text)" }}
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="w-full text-sm font-medium" style={{ color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

export default function AdminTemplatesPage() {
  const { user } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listCampaignTemplates({ search: debouncedSearch || undefined }, page, PAGE_SIZE),
    [page, debouncedSearch],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
            Templates
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Meta-approved WhatsApp templates, reusable across campaigns.
          </p>
        </div>
        <CreateTemplateForm onCreated={reload} />
      </div>

      <FilterInput
        label="Search templates by name"
        placeholder="Search name…"
        value={searchInput}
        onChange={(event) => {
          setSearchInput(event.target.value);
          setPage(1);
        }}
        className="w-64"
      />

      {loading && <TableSkeleton rows={6} columns={COLUMNS.length} />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load templates."} onRetry={reload} />
      )}
      {!loading &&
        !forbidden &&
        !error &&
        data &&
        (data.items.length === 0 ? (
          <EmptyState message="No templates match this search." />
        ) : (
          <div className="space-y-4">
            <Table columns={COLUMNS} rows={data.items} getRowKey={(t) => t.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}
    </div>
  );
}
