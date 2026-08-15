"use client";

import { useState } from "react";
import { Plus, Copy, Check, ExternalLink } from "lucide-react";
import { listLeadCaptureForms, createLeadCaptureForm, updateLeadCaptureForm, deleteLeadCaptureForm } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { Badge } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { FormField } from "@/components/admin/FormField";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import { SITE_URL } from "@/config/site";
import type { LeadCaptureForm } from "@/lib/services/crm/leadCaptureForms";

function publicUrlFor(form: LeadCaptureForm): string {
  return `${SITE_URL}/forms/${form.publicSlug}`;
}

/** A form's own submissions/leads-created/duplicate-rate — sourced
 *  directly from the form's own counters (submissionCount/duplicateCount),
 *  no new analytics infrastructure. "Leads created" is derived rather
 *  than stored separately: every submission that wasn't a recognized
 *  duplicate touch became exactly one new Lead. */
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="adm-focus-ring adm-btn adm-btn-secondary !px-2.5 !py-1.5 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label="Copy public form link"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

function CreateFormPanel({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await createLeadCaptureForm({ name: name.trim() });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not create form.");
      return;
    }
    setName("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button type="button" className="adm-focus-ring adm-btn adm-btn-primary" onClick={() => setOpen(true)}>
        <Plus size={15} /> New Form
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="adm-card flex flex-wrap items-end gap-3 p-4">
      <div className="w-64">
        <FormField id="lcf-name" label="Form name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website Contact Form" required />
      </div>
      <button type="submit" disabled={submitting || !name.trim()} className="adm-focus-ring adm-btn adm-btn-primary">
        {submitting ? "Creating…" : "Create"}
      </button>
      <button type="button" className="adm-focus-ring adm-btn adm-btn-secondary" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <p className="w-full text-sm" style={{ color: "var(--adm-danger)" }}>{error}</p>}
    </form>
  );
}

export default function AdminLeadCaptureFormsPage() {
  const { data, loading, error, forbidden, reload } = useAdminData(() => listLeadCaptureForms(), []);
  const forms = data?.forms ?? [];

  async function toggleActive(form: LeadCaptureForm) {
    await updateLeadCaptureForm(form.id, { active: !form.active });
    reload();
  }

  async function handleDelete(form: LeadCaptureForm) {
    if (!window.confirm(`Delete "${form.name}"? Its public link will stop accepting submissions immediately. Leads already captured through it are not affected.`)) return;
    await deleteLeadCaptureForm(form.id);
    reload();
  }

  const columns: TableColumn<LeadCaptureForm>[] = [
    { key: "name", header: "Form", render: (form) => <span className="font-medium">{form.name}</span> },
    {
      key: "status",
      header: "Status",
      render: (form) => <Badge tone={form.active ? "success" : "neutral"}>{form.active ? "Active" : "Paused"}</Badge>,
    },
    {
      key: "link",
      header: "Public link",
      render: (form) => (
        <div className="flex items-center gap-2">
          <a
            href={publicUrlFor(form)}
            target="_blank"
            rel="noreferrer"
            className="adm-focus-ring inline-flex items-center gap-1 text-xs underline"
            style={{ color: "var(--adm-accent)" }}
          >
            /forms/{form.publicSlug} <ExternalLink size={12} />
          </a>
          <CopyLinkButton url={publicUrlFor(form)} />
        </div>
      ),
    },
    { key: "submissions", header: "Submissions", align: "right", render: (form) => form.submissionCount },
    {
      key: "leadsCreated",
      header: "Leads created",
      align: "right",
      // Every submission that wasn't a recognized duplicate touch became
      // exactly one new Lead — derived from the form's own two counters,
      // not a separate stored value.
      render: (form) => form.submissionCount - form.duplicateCount,
    },
    { key: "duplicates", header: "Duplicates", align: "right", render: (form) => form.duplicateCount },
    {
      key: "actions",
      header: "",
      render: (form) => (
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="adm-focus-ring adm-btn adm-btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => toggleActive(form)}>
            {form.active ? "Pause" : "Activate"}
          </button>
          <button
            type="button"
            className="adm-focus-ring adm-btn adm-btn-secondary !px-2.5 !py-1.5 text-xs"
            style={{ color: "var(--adm-danger)" }}
            onClick={() => handleDelete(form)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
            Lead Capture
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Public forms that create real leads in this CRM — same pipeline, scoring, assignment, and automation as any lead created manually.
          </p>
        </div>
        <CreateFormPanel onCreated={reload} />
      </div>

      {forbidden ? (
        <ForbiddenState />
      ) : loading ? (
        <TableSkeleton rows={4} columns={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : forms.length === 0 ? (
        <EmptyState message="No lead capture forms yet. Create one to get a public link you can share or link to from your own website." />
      ) : (
        <Table columns={columns} rows={forms} getRowKey={(form) => form.id} />
      )}
    </div>
  );
}
