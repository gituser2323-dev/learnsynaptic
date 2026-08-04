"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { listAttendance, attendanceCsvHref, markAttendance } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { FilterInput } from "@/components/admin/FilterControls";
import { FormField } from "@/components/admin/FormField";
import { Badge } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingState, ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import type { Attendance, AttendanceListFilters } from "@/lib/services/attendance";

const PAGE_SIZE = 20;

const COLUMNS: TableColumn<Attendance>[] = [
  { key: "registrationId", header: "Registration ID", render: (a) => a.registrationId },
  { key: "sessionLabel", header: "Session", render: (a) => a.sessionLabel },
  { key: "sessionDate", header: "Session Date", render: (a) => new Date(a.sessionDate).toLocaleDateString() },
  {
    key: "present",
    header: "Present",
    render: (a) => <Badge tone={a.present ? "success" : "danger"}>{a.present ? "Present" : "Absent"}</Badge>,
  },
  { key: "markedAt", header: "Marked At", render: (a) => new Date(a.markedAt).toLocaleString() },
];

/**
 * No registration picker/autocomplete — that needs infrastructure this
 * page doesn't have yet (a searchable lookup against the Registrations
 * list). Plain text field with a clear hint instead of pretending to
 * solve a UX problem this build doesn't actually address; a real
 * decision for a follow-up, not silently skipped (see CHANGELOG).
 */
function MarkAttendanceForm({ onMarked }: { onMarked: () => void }) {
  const [registrationId, setRegistrationId] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [present, setPresent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await markAttendance({ registrationId, sessionLabel, sessionDate, present });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not mark attendance.");
      return;
    }
    setRegistrationId("");
    setSessionLabel("");
    onMarked();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border p-4"
      style={{ borderColor: "var(--adm-border)", background: "var(--adm-surface)" }}
      noValidate
    >
      <FormField
        id="att-reg-id"
        label="Registration ID"
        required
        value={registrationId}
        onChange={(event) => setRegistrationId(event.target.value)}
        className="w-64"
        placeholder="Paste a Registration ID"
      />
      <FormField
        id="att-session"
        label="Session Label"
        required
        value={sessionLabel}
        onChange={(event) => setSessionLabel(event.target.value)}
        className="w-52"
        placeholder="e.g. Week 1 — Live Class"
      />
      <FormField
        id="att-date"
        label="Session Date"
        type="date"
        required
        value={sessionDate}
        onChange={(event) => setSessionDate(event.target.value)}
        className="w-40"
      />
      <label className="flex items-center gap-2 pb-2.5 text-sm" style={{ color: "var(--adm-text)" }}>
        <input type="checkbox" checked={present} onChange={(event) => setPresent(event.target.checked)} />
        Present
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-70"
        style={{ background: "var(--adm-accent)" }}
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        Mark Attendance
      </button>
      {error && (
        <p role="alert" className="w-full text-sm font-medium" style={{ color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
    </form>
  );
}

export default function AdminAttendancePage() {
  const { user } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [registrationId, setRegistrationId] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");

  const filters: AttendanceListFilters = {
    registrationId: registrationId || undefined,
    sessionLabel: sessionLabel || undefined,
  };

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listAttendance(filters, page, PAGE_SIZE),
    [page, registrationId, sessionLabel],
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
            Attendance
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Record session attendance and review history.
          </p>
        </div>
        <a
          href={attendanceCsvHref(filters)}
          className="adm-focus-ring adm-btn adm-btn-secondary"
        >
          <Download size={15} /> Export CSV
        </a>
      </div>

      <MarkAttendanceForm onMarked={reload} />

      <div className="flex flex-wrap gap-3">
        <FilterInput
          label="Filter by registration ID"
          placeholder="Registration ID"
          value={registrationId}
          onChange={(event) => onFilterChange(setRegistrationId)(event.target.value)}
          className="w-64"
        />
        <FilterInput
          label="Filter by session label"
          placeholder="Session label"
          value={sessionLabel}
          onChange={(event) => onFilterChange(setSessionLabel)(event.target.value)}
          className="w-56"
        />
      </div>

      {loading && <LoadingState label="Loading attendance…" />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load attendance."} onRetry={reload} />
      )}
      {!loading &&
        !forbidden &&
        !error &&
        data &&
        (data.items.length === 0 ? (
          <EmptyState message="No attendance records match these filters." />
        ) : (
          <div className="space-y-4">
            <Table columns={COLUMNS} rows={data.items} getRowKey={(a) => a.id} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </div>
        ))}
    </div>
  );
}
