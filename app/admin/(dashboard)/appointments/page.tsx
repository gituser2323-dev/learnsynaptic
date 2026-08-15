"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Copy, Check, ExternalLink } from "lucide-react";
import {
  listAppointmentTypes,
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,
  listAppointments,
  updateAppointmentStatus,
  listStaff,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { Badge, appointmentStatusTone } from "@/components/admin/Badge";
import { Table, type TableColumn } from "@/components/admin/Table";
import { FormField } from "@/components/admin/FormField";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import { SITE_URL } from "@/config/site";
import type { AppointmentType, Appointment, AppointmentStatus, WeeklyAvailabilitySlot } from "@/lib/services/crm/appointments";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function publicUrlFor(type: AppointmentType): string {
  return `${SITE_URL}/book/${type.publicSlug}`;
}

function minutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeInputToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

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
      aria-label="Copy public booking link"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

interface DayRow {
  enabled: boolean;
  start: string;
  end: string;
}

function defaultDayRows(): DayRow[] {
  // Mon–Fri, 9:00–17:00 enabled by default — a reasonable starting
  // point an admin edits, not a forced default.
  return WEEKDAY_LABELS.map((_, dayOfWeek) => ({
    enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
    start: "09:00",
    end: "17:00",
  }));
}

function rowsFromWeeklyAvailability(slots: WeeklyAvailabilitySlot[]): DayRow[] {
  const rows = WEEKDAY_LABELS.map(() => ({ enabled: false, start: "09:00", end: "17:00" }));
  for (const slot of slots) {
    rows[slot.dayOfWeek] = { enabled: true, start: minutesToTimeInput(slot.startMinute), end: minutesToTimeInput(slot.endMinute) };
  }
  return rows;
}

function rowsToWeeklyAvailability(rows: DayRow[]): WeeklyAvailabilitySlot[] {
  const slots: WeeklyAvailabilitySlot[] = [];
  rows.forEach((row, dayOfWeek) => {
    if (!row.enabled) return;
    slots.push({ dayOfWeek: dayOfWeek as WeeklyAvailabilitySlot["dayOfWeek"], startMinute: timeInputToMinutes(row.start), endMinute: timeInputToMinutes(row.end) });
  });
  return slots;
}

function AppointmentTypeFormPanel({
  existing,
  onDone,
  onCancel,
}: {
  existing?: AppointmentType;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { data: staffData } = useAdminData(() => listStaff(), []);
  const staff = staffData?.users ?? [];

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [durationMinutes, setDurationMinutes] = useState(existing?.durationMinutes ?? 30);
  const [bufferMinutes, setBufferMinutes] = useState(existing?.bufferMinutes ?? 0);
  const [timezone, setTimezone] = useState(existing?.timezone ?? "Asia/Kolkata");
  const [assignedCounsellorId, setAssignedCounsellorId] = useState(existing?.assignedCounsellorId ?? "");
  const [days, setDays] = useState<DayRow[]>(existing ? rowsFromWeeklyAvailability(existing.weeklyAvailability) : defaultDayRows());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      durationMinutes,
      bufferMinutes,
      timezone: timezone.trim(),
      weeklyAvailability: rowsToWeeklyAvailability(days),
      assignedCounsellorId,
    };
    const result = existing ? await updateAppointmentType(existing.id, input) : await createAppointmentType(input);
    setSubmitting(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not save appointment type.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="adm-card space-y-4 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="apt-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Free Counselling Call" required />
        <FormField id="apt-description" label="Description (shown to customers)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        <FormField id="apt-duration" label="Duration (minutes)" type="number" min={5} max={480} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} required />
        <FormField id="apt-buffer" label="Buffer before/after (minutes)" type="number" min={0} max={240} value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))} />
        <FormField id="apt-timezone" label="Timezone (IANA, e.g. Asia/Kolkata)" value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
        <div>
          <label htmlFor="apt-counsellor" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            Assigned counsellor
          </label>
          <select
            id="apt-counsellor"
            required
            value={assignedCounsellorId}
            onChange={(e) => setAssignedCounsellorId(e.target.value)}
            className="adm-input adm-focus-ring w-full"
          >
            <option value="">Select a counsellor…</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name || member.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
          Available days &amp; times
        </p>
        <div className="space-y-2">
          {WEEKDAY_LABELS.map((label, dayOfWeek) => {
            const row = days[dayOfWeek];
            return (
              <div key={label} className="flex flex-wrap items-center gap-3">
                <label className="flex w-20 items-center gap-2 text-sm" style={{ color: "var(--adm-text)" }}>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => setDays((prev) => prev.map((r, i) => (i === dayOfWeek ? { ...r, enabled: e.target.checked } : r)))}
                  />
                  {label}
                </label>
                <input
                  type="time"
                  disabled={!row.enabled}
                  value={row.start}
                  onChange={(e) => setDays((prev) => prev.map((r, i) => (i === dayOfWeek ? { ...r, start: e.target.value } : r)))}
                  className="adm-input adm-focus-ring !w-32"
                />
                <span style={{ color: "var(--adm-text-muted)" }}>to</span>
                <input
                  type="time"
                  disabled={!row.enabled}
                  value={row.end}
                  onChange={(e) => setDays((prev) => prev.map((r, i) => (i === dayOfWeek ? { ...r, end: e.target.value } : r)))}
                  className="adm-input adm-focus-ring !w-32"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting || !name.trim() || !assignedCounsellorId} className="adm-focus-ring adm-btn adm-btn-primary">
          {submitting ? "Saving…" : existing ? "Save changes" : "Create"}
        </button>
        <button type="button" className="adm-focus-ring adm-btn adm-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        {error && (
          <p className="text-sm" style={{ color: "var(--adm-danger)" }}>
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function AppointmentTypesTab() {
  const { data, loading, error, forbidden, reload } = useAdminData(() => listAppointmentTypes(), []);
  const appointmentTypes = data?.appointmentTypes ?? [];
  const { data: staffData } = useAdminData(() => listStaff(), []);
  const staffById = new Map((staffData?.users ?? []).map((u) => [u.id, u.name || u.email]));

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function toggleActive(type: AppointmentType) {
    await updateAppointmentType(type.id, { active: !type.active });
    reload();
  }

  async function handleDelete(type: AppointmentType) {
    if (!window.confirm(`Delete "${type.name}"? Its public link will stop accepting bookings immediately. Appointments already booked through it are not affected.`)) return;
    await deleteAppointmentType(type.id);
    reload();
  }

  const columns: TableColumn<AppointmentType>[] = [
    { key: "name", header: "Type", render: (type) => <span className="font-medium">{type.name}</span> },
    { key: "duration", header: "Duration", align: "right", render: (type) => `${type.durationMinutes} min` },
    { key: "counsellor", header: "Counsellor", render: (type) => staffById.get(type.assignedCounsellorId) ?? "—" },
    { key: "status", header: "Status", render: (type) => <Badge tone={type.active ? "success" : "neutral"}>{type.active ? "Active" : "Paused"}</Badge> },
    {
      key: "link",
      header: "Public link",
      render: (type) => (
        <div className="flex items-center gap-2">
          <a href={publicUrlFor(type)} target="_blank" rel="noreferrer" className="adm-focus-ring inline-flex items-center gap-1 text-xs underline" style={{ color: "var(--adm-accent)" }}>
            /book/{type.publicSlug} <ExternalLink size={12} />
          </a>
          <CopyLinkButton url={publicUrlFor(type)} />
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (type) => (
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="adm-focus-ring adm-btn adm-btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => setEditingId(type.id)}>
            Edit
          </button>
          <button type="button" className="adm-focus-ring adm-btn adm-btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => toggleActive(type)}>
            {type.active ? "Pause" : "Activate"}
          </button>
          <button type="button" className="adm-focus-ring adm-btn adm-btn-secondary !px-2.5 !py-1.5 text-xs" style={{ color: "var(--adm-danger)" }} onClick={() => handleDelete(type)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  const editingType = appointmentTypes.find((t) => t.id === editingId);

  return (
    <div className="space-y-4">
      {creating ? (
        <AppointmentTypeFormPanel
          onDone={() => {
            setCreating(false);
            reload();
          }}
          onCancel={() => setCreating(false)}
        />
      ) : editingType ? (
        <AppointmentTypeFormPanel
          existing={editingType}
          onDone={() => {
            setEditingId(null);
            reload();
          }}
          onCancel={() => setEditingId(null)}
        />
      ) : (
        <button type="button" className="adm-focus-ring adm-btn adm-btn-primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> New Appointment Type
        </button>
      )}

      {forbidden ? (
        <ForbiddenState />
      ) : loading ? (
        <TableSkeleton rows={4} columns={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : appointmentTypes.length === 0 ? (
        <EmptyState message="No appointment types yet. Create one to get a public booking link you can share or link to from your own website." />
      ) : (
        <Table columns={columns} rows={appointmentTypes} getRowKey={(type) => type.id} />
      )}
    </div>
  );
}

function BookingsTab() {
  const { data, loading, error, forbidden, reload } = useAdminData(() => listAppointments({}, 1, 50), []);
  const appointments = data?.items ?? [];
  const { data: typesData } = useAdminData(() => listAppointmentTypes(), []);
  const typeNameById = new Map((typesData?.appointmentTypes ?? []).map((t) => [t.id, t.name]));

  async function setStatus(appointment: Appointment, status: AppointmentStatus) {
    await updateAppointmentStatus(appointment.id, { status });
    reload();
  }

  const columns: TableColumn<Appointment>[] = [
    { key: "type", header: "Type", render: (a) => typeNameById.get(a.appointmentTypeId) ?? "—" },
    { key: "when", header: "When", render: (a) => new Date(a.startAt).toLocaleString("en-IN", { timeZone: a.timezone }) },
    { key: "status", header: "Status", render: (a) => <Badge tone={appointmentStatusTone(a.status)}>{a.status.replace("_", " ")}</Badge> },
    {
      key: "lead",
      header: "Lead",
      render: (a) => (
        <Link href={`/admin/leads/${a.leadId}`} className="adm-focus-ring underline" style={{ color: "var(--adm-accent)" }}>
          View lead
        </Link>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (a) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {a.status === "scheduled" && (
            <button type="button" className="adm-focus-ring adm-btn adm-btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => setStatus(a, "confirmed")}>
              Confirm
            </button>
          )}
          {(a.status === "scheduled" || a.status === "confirmed") && (
            <>
              <button type="button" className="adm-focus-ring adm-btn adm-btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => setStatus(a, "completed")}>
                Complete
              </button>
              <button type="button" className="adm-focus-ring adm-btn adm-btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => setStatus(a, "no_show")}>
                No-show
              </button>
              <button type="button" className="adm-focus-ring adm-btn adm-btn-secondary !px-2.5 !py-1.5 text-xs" style={{ color: "var(--adm-danger)" }} onClick={() => setStatus(a, "cancelled")}>
                Cancel
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {forbidden ? (
        <ForbiddenState />
      ) : loading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : appointments.length === 0 ? (
        <EmptyState message="No appointments booked yet." />
      ) : (
        <Table columns={columns} rows={appointments} getRowKey={(a) => a.id} />
      )}
    </div>
  );
}

export default function AdminAppointmentsPage() {
  const [tab, setTab] = useState<"types" | "bookings">("types");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
          Appointments
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
          Public booking pages that create real, appointment-attached leads in this CRM — the same pipeline, scoring, assignment, and automation as any lead created manually.
        </p>
      </div>

      <div className="flex gap-2 border-b" style={{ borderColor: "var(--adm-border)" }}>
        {(["types", "bookings"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className="adm-focus-ring px-3 py-2 text-sm font-medium"
            style={{
              color: tab === t ? "var(--adm-accent)" : "var(--adm-text-secondary)",
              borderBottom: tab === t ? "2px solid var(--adm-accent)" : "2px solid transparent",
            }}
            onClick={() => setTab(t)}
          >
            {t === "types" ? "Appointment Types" : "Bookings"}
          </button>
        ))}
      </div>

      {tab === "types" ? <AppointmentTypesTab /> : <BookingsTab />}
    </div>
  );
}
