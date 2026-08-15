"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Sparkles, Tag as TagIcon, UserCircle, Paperclip, Trash2, Download, CalendarPlus, ExternalLink, XCircle } from "lucide-react";
import {
  getLead,
  updateLead,
  setLeadTags,
  assignLead,
  listTags,
  listStaff,
  listCustomFieldDefinitions,
  listActivities,
  createActivity,
  listTasks,
  createTask,
  completeTask,
  listLeadInsights,
  analyzeLeadWithAi,
  uploadFile,
  listFiles,
  deleteFile,
  fileDownloadPath,
  scheduleMeeting,
  listMeetings,
  cancelMeeting,
  listAppointments,
  updateAppointmentStatus,
  listAppointmentTypes,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { Badge, leadStatusTone, leadHealthTone, buyingIntentTone, taskPriorityTone, appointmentStatusTone } from "@/components/admin/Badge";
import { FormField } from "@/components/admin/FormField";
import { FilterSelect } from "@/components/admin/FilterControls";
import { ForbiddenState, ErrorState, EmptyState, LoadingState } from "@/components/admin/DataStates";
import { Pagination } from "@/components/admin/Pagination";
import type { LeadStatus } from "@/lib/services/leads";
import type { ActivityType } from "@/lib/services/crm/activities";
import type { TaskPriority } from "@/lib/services/crm/tasks";
import type { CalendarProviderId, MeetingStatus } from "@/lib/services/calendar";
import type { Appointment, AppointmentStatus } from "@/lib/services/crm/appointments";

const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "nurture", "registered", "closed"];
const ACTIVITY_TYPES: ActivityType[] = ["note", "call", "meeting", "email"];

// Calendar & Meeting Connectors (Module 6.3) — hardcoded here rather
// than imported from "@/lib/services/calendar" (that barrel re-exports
// calendarService, which pulls in lib/db → mongoose): the same
// "can't bundle a server-only barrel into a client component" trap
// WorkflowStepBuilder.tsx's own top-of-file comment already documents,
// hit a second time.
const CALENDAR_PROVIDER_OPTIONS: { id: CalendarProviderId; label: string }[] = [
  { id: "google_calendar", label: "Google Calendar" },
  { id: "google_meet", label: "Google Meet" },
  { id: "microsoft_outlook_calendar", label: "Microsoft Outlook Calendar" },
  { id: "microsoft_teams_meetings", label: "Microsoft Teams (Meetings)" },
  { id: "zoom", label: "Zoom" },
];

function meetingStatusTone(status: MeetingStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "cancelled") return "danger";
  if (status === "completed") return "neutral";
  if (status === "confirmed") return "success";
  return "info"; // scheduled
}

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="adm-card adm-animate-in p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

/** AI CRM (Phase 5), Module 5.1 — reads only the single most recent
 *  insight (page 1, limit 1 of the same reverse-chronological history
 *  the API stores) rather than needing a dedicated "latest" endpoint. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** File Storage (Phase 6), Module 6.2 — "prepare reusable attachment
 *  support for Leads/Activities/Notes/Tasks/Opportunities," realized
 *  here for Leads specifically (one concrete, low-risk UI surface
 *  rather than a redesign across every CRM screen — the same "reuse
 *  the generic upload API, don't invent per-entity upload logic"
 *  principle every other module this pass touches already follows).
 *  Files are `CRM_ATTACHMENT` category, private by default — "do not
 *  make sensitive CRM/customer documents publicly accessible." */
function LeadAttachmentsSection({ leadId }: { leadId: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, loading, reload } = useAdminData(
    () => listFiles({ relatedEntityType: "Lead", relatedEntityId: leadId }, 1, 20),
    [leadId],
  );

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    const result = await uploadFile(file, {
      category: "CRM_ATTACHMENT",
      visibility: "private",
      relatedEntityType: "Lead",
      relatedEntityId: leadId,
    });
    setUploading(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Upload failed.");
      return;
    }
    reload();
  }

  async function handleDelete(id: string) {
    await deleteFile(id);
    reload();
  }

  return (
    <SectionCard
      title="Attachments"
      action={
        <label className="adm-focus-ring adm-btn adm-btn-secondary cursor-pointer text-xs" style={uploading ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
          {uploading && <Loader2 size={12} className="animate-spin" />}
          <Paperclip size={12} /> Upload
          <input type="file" className="sr-only" disabled={uploading} onChange={handleUpload} />
        </label>
      }
    >
      <div className="space-y-2">
        {error && (
          <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
            {error}
          </p>
        )}
        {loading && (
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            Loading attachments…
          </p>
        )}
        {!loading && data && data.items.length === 0 && (
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            No attachments yet.
          </p>
        )}
        {!loading &&
          data &&
          data.items.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-2 border-t pt-2 first:border-t-0 first:pt-0" style={{ borderColor: "var(--adm-border)" }}>
              <div className="min-w-0">
                <p className="truncate text-sm" style={{ color: "var(--adm-text)" }} title={file.originalFilename}>
                  {file.originalFilename}
                </p>
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {formatFileSize(file.sizeBytes)} · {new Date(file.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a href={fileDownloadPath(file.id)} target="_blank" rel="noreferrer" className="adm-focus-ring adm-icon-btn" aria-label="Download">
                  <Download size={13} />
                </a>
                <button type="button" onClick={() => handleDelete(file.id)} className="adm-focus-ring adm-icon-btn" aria-label="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
      </div>
    </SectionCard>
  );
}

/** Calendar & Meeting Connectors (Phase 6), Module 6.3 — "a scheduled
 *  meeting must automatically appear inside the Lead Timeline" is
 *  satisfied by calendarService.scheduleMeeting() itself (a real
 *  Activity row, visible in the Timeline tab below); this section is
 *  the scheduling surface and the meeting's own status/link/sync
 *  state, the same "reuse the generic API, one concrete UI surface"
 *  principle LeadAttachmentsSection already established for 6.2. */
function LeadMeetingsSection({ leadId, leadEmail, leadName }: { leadId: string; leadEmail: string; leadName?: string }) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<CalendarProviderId>("google_calendar");
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [createFollowUpTask, setCreateFollowUpTask] = useState(false);

  const { data, loading, reload } = useAdminData(
    () => listMeetings({ relatedEntityType: "Lead", relatedEntityId: leadId }, 1, 20),
    [leadId],
  );

  async function handleSchedule() {
    if (!title.trim() || !startAt) {
      setError("Title and start time are required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const start = new Date(startAt);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const result = await scheduleMeeting({
      provider,
      title: title.trim(),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      invitees: [{ email: leadEmail, name: leadName }],
      reminderMinutesBefore: 30,
      relatedEntityType: "Lead",
      relatedEntityId: leadId,
      createFollowUpTask,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Couldn't schedule the meeting.");
      return;
    }
    setShowForm(false);
    setTitle("");
    setStartAt("");
    reload();
  }

  async function handleCancel(id: string) {
    await cancelMeeting(id);
    reload();
  }

  return (
    <SectionCard
      title="Meetings"
      action={
        <button type="button" onClick={() => setShowForm((v) => !v)} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
          <CalendarPlus size={12} /> Schedule
        </button>
      }
    >
      <div className="space-y-3">
        {showForm && (
          <div className="space-y-2 rounded-[var(--adm-radius-sm)] border p-3" style={{ borderColor: "var(--adm-border)" }}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FilterSelect label="Provider" value={provider} onChange={(e) => setProvider(e.target.value as CalendarProviderId)}>
                {CALENDAR_PROVIDER_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </FilterSelect>
              <FormField
                id="meeting-duration"
                label="Duration (minutes)"
                type="number"
                min={5}
                value={String(durationMinutes)}
                onChange={(e) => setDurationMinutes(Number(e.target.value) || 30)}
              />
            </div>
            <FormField id="meeting-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Counselling call" />
            <FormField
              id="meeting-start"
              label="Start time"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
              <input type="checkbox" checked={createFollowUpTask} onChange={(e) => setCreateFollowUpTask(e.target.checked)} className="adm-focus-ring" />
              Also create a follow-up task for me, due when the meeting ends
            </label>
            <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
              Invites {leadEmail}. The chosen provider must be connected and enabled in Settings → Integrations.
            </p>
            {error && (
              <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
                {error}
              </p>
            )}
            <button type="button" onClick={handleSchedule} disabled={submitting} className="adm-focus-ring adm-btn adm-btn-primary text-xs">
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Schedule meeting
            </button>
          </div>
        )}

        {loading && (
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            Loading meetings…
          </p>
        )}
        {!loading && data && data.items.length === 0 && (
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            No meetings yet.
          </p>
        )}
        {!loading &&
          data &&
          data.items.map((meeting) => (
            <div key={meeting.id} className="flex items-start justify-between gap-2 border-t pt-2 first:border-t-0 first:pt-0" style={{ borderColor: "var(--adm-border)" }}>
              <div className="min-w-0">
                <p className="truncate text-sm" style={{ color: "var(--adm-text)" }} title={meeting.title}>
                  {meeting.title}
                </p>
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {new Date(meeting.startAt).toLocaleString()} · {CALENDAR_PROVIDER_OPTIONS.find((p) => p.id === meeting.provider)?.label ?? meeting.provider}
                </p>
                {meeting.syncStatus === "failed" && (
                  <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
                    Sync failed{meeting.lastSyncError ? `: ${meeting.lastSyncError}` : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge tone={meetingStatusTone(meeting.status)}>{meeting.status}</Badge>
                {meeting.meetingLink && (
                  <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="adm-focus-ring adm-icon-btn" aria-label="Join meeting">
                    <ExternalLink size={13} />
                  </a>
                )}
                {meeting.status !== "cancelled" && meeting.status !== "completed" && (
                  <button type="button" onClick={() => handleCancel(meeting.id)} className="adm-focus-ring adm-icon-btn" aria-label="Cancel meeting">
                    <XCircle size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </SectionCard>
  );
}

/** Appointment Booking (the Growth-track module after Lead Capture) —
 *  read/act-only from this page, mirroring LeadMeetingsSection's own
 *  display shape immediately above. No "create appointment from Lead
 *  Detail" button here: staff already have LeadMeetingsSection for
 *  ad-hoc scheduling; Appointment creation is the public booking flow's
 *  own job (see app/book/[slug]/page.tsx), not a parallel staff-facing
 *  scheduling surface. */
function LeadAppointmentsSection({ leadId }: { leadId: string }) {
  const { data, loading, reload } = useAdminData(() => listAppointments({ leadId }, 1, 20), [leadId]);
  const { data: typesData } = useAdminData(() => listAppointmentTypes(), []);
  const typeNameById = new Map((typesData?.appointmentTypes ?? []).map((t) => [t.id, t.name]));

  async function setStatus(appointment: Appointment, status: AppointmentStatus) {
    await updateAppointmentStatus(appointment.id, { status });
    reload();
  }

  return (
    <SectionCard title="Appointments">
      <div className="space-y-3">
        {loading && (
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            Loading appointments…
          </p>
        )}
        {!loading && data && data.items.length === 0 && (
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            No appointments yet.
          </p>
        )}
        {!loading &&
          data &&
          data.items.map((appointment) => (
            <div key={appointment.id} className="flex items-start justify-between gap-2 border-t pt-2 first:border-t-0 first:pt-0" style={{ borderColor: "var(--adm-border)" }}>
              <div className="min-w-0">
                <p className="truncate text-sm" style={{ color: "var(--adm-text)" }}>
                  {typeNameById.get(appointment.appointmentTypeId) ?? "Appointment"}
                </p>
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {new Date(appointment.startAt).toLocaleString("en-IN", { timeZone: appointment.timezone })}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <Badge tone={appointmentStatusTone(appointment.status)}>{appointment.status.replace("_", " ")}</Badge>
                {(appointment.status === "scheduled" || appointment.status === "confirmed") && (
                  <button type="button" onClick={() => setStatus(appointment, "cancelled")} className="adm-focus-ring adm-icon-btn" aria-label="Cancel appointment">
                    <XCircle size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </SectionCard>
  );
}

function AiInsightsSection({ leadId }: { leadId: string }) {
  const [analyzing, setAnalyzing] = useState(false);
  const { data, loading, error, reload } = useAdminData(() => listLeadInsights(leadId, 1, 1), [leadId]);
  const insight = data?.items[0];

  async function handleAnalyze() {
    setAnalyzing(true);
    await analyzeLeadWithAi(leadId);
    setAnalyzing(false);
    reload();
  }

  const analyzeButton = (
    <button
      type="button"
      onClick={handleAnalyze}
      disabled={analyzing}
      className="adm-focus-ring adm-btn adm-btn-secondary"
    >
      {analyzing && <Loader2 size={14} className="animate-spin" />}
      {insight ? "Analyze Again" : "Analyze Now"}
    </button>
  );

  return (
    <SectionCard title="AI Insights" action={<Sparkles size={16} style={{ color: "var(--adm-text-muted)" }} />}>
      {loading && <LoadingState label="Loading AI insights…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && !insight && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
            No AI analysis yet for this lead.
          </p>
          {analyzeButton}
        </div>
      )}
      {!loading && !error && insight && insight.status === "unavailable" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
            AI insights are unavailable: no AI provider is configured for this environment.
          </p>
          {analyzeButton}
        </div>
      )}
      {!loading && !error && insight && insight.status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "var(--adm-danger)" }}>
            Last analysis failed: {insight.errorMessage ?? "unknown error"}.
          </p>
          {analyzeButton}
        </div>
      )}
      {!loading && !error && insight && insight.status === "ok" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="adm-chip"
              style={{ background: "var(--adm-accent-soft)", color: "var(--adm-accent)" }}
              title="AI-generated lead score (0-100)"
            >
              <span className="adm-chip-dot" aria-hidden="true" />
              AI Score {insight.score}
            </span>
            {insight.health && <Badge tone={leadHealthTone(insight.health)}>{insight.health} · priority</Badge>}
            {insight.buyingIntent && <Badge tone={buyingIntentTone(insight.buyingIntent)}>{insight.buyingIntent} intent</Badge>}
            <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
              Confidence {insight.confidence ?? 0}%
            </span>
          </div>

          {insight.summary && (
            <p className="text-sm" style={{ color: "var(--adm-text-secondary)" }}>
              {insight.summary}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                Strengths
              </p>
              {insight.strengths && insight.strengths.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-sm" style={{ color: "var(--adm-text)" }}>
                  {insight.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  None noted.
                </p>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                Risks
              </p>
              {insight.risks && insight.risks.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-sm" style={{ color: "var(--adm-text)" }}>
                  {insight.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  None noted.
                </p>
              )}
            </div>
          </div>

          {insight.nextAction && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                Suggested Next Action
              </p>
              <p className="text-sm" style={{ color: "var(--adm-text)" }}>
                {insight.nextAction}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--adm-border)" }}>
            <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
              Last analysis: {new Date(insight.createdAt).toLocaleString()}
              {insight.providerId ? ` · ${insight.providerId}` : ""}
            </p>
            {analyzeButton}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function TimelineTab({ leadId }: { leadId: string }) {
  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState<ActivityType>("note");
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAdminData(() => listActivities("Lead", leadId, page, 50), [leadId, page]);

  async function handleAddNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteBody.trim()) return;
    setSubmitting(true);
    const result = await createActivity({ entityType: "Lead", entityId: leadId, type: noteType, body: noteBody.trim() });
    setSubmitting(false);
    if (result.success) {
      setNoteBody("");
      // A new entry always lands on page 1 (reverse-chronological) —
      // jump back there so the counsellor sees what they just logged
      // instead of it silently appearing off-screen on whatever page
      // they happened to be viewing.
      if (page === 1) reload();
      else setPage(1);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAddNote} className="adm-card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Activity type" value={noteType} onChange={(e) => setNoteType(e.target.value as ActivityType)} className="w-36">
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </FilterSelect>
          <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            Log a note, call, meeting, or email on this lead&apos;s timeline.
          </span>
        </div>
        <textarea
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          placeholder="What happened?"
          rows={3}
          className="adm-input adm-focus-ring w-full resize-none py-2"
        />
        <button type="submit" disabled={submitting || !noteBody.trim()} className="adm-focus-ring adm-btn adm-btn-primary">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Add to timeline
        </button>
      </form>

      {loading && <LoadingState label="Loading timeline…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && data.items.length === 0 && <EmptyState message="No activity yet." />}
      {!loading && !error && data && data.items.length > 0 && (
        <div className="space-y-2">
          {data.items.map((activity) => (
            <div key={activity.id} className="adm-card p-4">
              <div className="flex items-center justify-between gap-3">
                <Badge tone={activity.type === "system" ? "neutral" : "info"}>{activity.type}</Badge>
                <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {new Date(activity.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
                {activity.body}
              </p>
            </div>
          ))}
          {data.totalPages > 1 && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />}
        </div>
      )}
    </div>
  );
}

function TasksTab({ leadId }: { leadId: string }) {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: staff } = useAdminData(() => listStaff(), []);
  const { data, loading, error, reload } = useAdminData(
    () => listTasks({ entityType: "Lead", entityId: leadId }, 1, 20),
    [leadId],
  );

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !dueAt || !assigneeId) return;
    setSubmitting(true);
    const result = await createTask({
      title: title.trim(),
      dueAt: new Date(dueAt).toISOString(),
      priority,
      assigneeId,
      entityType: "Lead",
      entityId: leadId,
    });
    setSubmitting(false);
    if (result.success) {
      setTitle("");
      setDueAt("");
      reload();
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="adm-card space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField id="task-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <FormField id="task-due" label="Due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
        </div>
        <div className="flex flex-wrap gap-3">
          <FilterSelect label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="w-32">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </FilterSelect>
          <FilterSelect label="Assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-56">
            <option value="">Assign to…</option>
            {staff?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </FilterSelect>
        </div>
        <button type="submit" disabled={submitting || !title.trim() || !dueAt || !assigneeId} className="adm-focus-ring adm-btn adm-btn-primary">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Create task
        </button>
      </form>

      {loading && <LoadingState label="Loading tasks…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && data.items.length === 0 && <EmptyState message="No tasks for this lead yet." />}
      {!loading && !error && data && data.items.length > 0 && (
        <div className="space-y-2">
          {data.items.map((task) => (
            <div key={task.id} className="adm-card flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: task.status === "completed" ? "var(--adm-text-muted)" : "var(--adm-text)" }}>
                  {task.title}
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  <Badge tone={taskPriorityTone(task.priority)}>{task.priority}</Badge>
                  Due {new Date(task.dueAt).toLocaleDateString()}
                </p>
              </div>
              {task.status === "open" ? (
                <button
                  type="button"
                  onClick={() => completeTask(task.id).then(reload)}
                  className="adm-focus-ring adm-btn adm-btn-secondary shrink-0"
                >
                  Complete
                </button>
              ) : (
                <Badge tone="success">Done</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeadDetailPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leadId = params.id;
  const [tab, setTab] = useState<"timeline" | "tasks">("timeline");
  const [savingTags, setSavingTags] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  const { data: leadData, loading, error, forbidden, reload } = useAdminData(() => getLead(leadId), [leadId]);
  const { data: tagsData } = useAdminData(() => listTags(), []);
  const { data: staffData } = useAdminData(() => listStaff(), []);
  const { data: fieldsData } = useAdminData(() => listCustomFieldDefinitions(), []);

  if (loading) return <LoadingState label="Loading lead…" />;
  if (forbidden) return <ForbiddenState role={user?.role} />;
  if (error || !leadData) return <ErrorState message={error ?? "Could not load this lead."} onRetry={reload} />;

  const lead = leadData.lead;
  const allTags = tagsData?.tags ?? [];
  const leadTags = allTags.filter((t) => lead.tags.includes(t.id));

  async function toggleTag(tagId: string) {
    setSavingTags(true);
    const next = lead.tags.includes(tagId) ? lead.tags.filter((t) => t !== tagId) : [...lead.tags, tagId];
    await setLeadTags(leadId, next);
    setSavingTags(false);
    reload();
  }

  async function handleStatusChange(status: LeadStatus) {
    await updateLead(leadId, { status });
    reload();
  }

  async function handleAssign(counsellorId: string) {
    if (!counsellorId) return;
    setSavingAssign(true);
    await assignLead(leadId, counsellorId);
    setSavingAssign(false);
    reload();
  }

  // A counsellor can't call listStaff() (manager+ only — RBAC) so
  // staffData is always empty for them; if the lead they're looking at
  // is assigned to them (the only way they could have reached this page
  // at all), that's their own identity, not an unresolved lookup.
  const assignedStaff =
    staffData?.users.find((u) => u.id === lead.assignedCounsellorId) ??
    (lead.assignedCounsellorId && lead.assignedCounsellorId === user?.id ? user : undefined);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.push("/admin/leads")}
        className="adm-focus-ring flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--adm-accent)]"
        style={{ color: "var(--adm-text-muted)" }}
      >
        <ArrowLeft size={15} /> Back to Leads
      </button>

      <div className="adm-animate-in flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="!text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
            {lead.name}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            {lead.email} · {lead.phone}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={leadStatusTone(lead.status)}>{lead.status}</Badge>
          <Badge tone={leadHealthTone(lead.health)}>{lead.health} · priority</Badge>
          <span
            className="adm-chip"
            style={{ background: "var(--adm-accent-soft)", color: "var(--adm-accent)" }}
            title="Lead score (0-100, rules-based)"
          >
            <span className="adm-chip-dot" aria-hidden="true" />
            Score {lead.score}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Details">
          <div className="space-y-3">
            <FilterSelect label="Status" value={lead.status} onChange={(e) => handleStatusChange(e.target.value as LeadStatus)} className="w-full">
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </FilterSelect>
            <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
              Program: <span style={{ color: "var(--adm-text)" }}>{lead.program ?? "—"}</span>
            </p>
            <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
              Source: <span style={{ color: "var(--adm-text)" }}>{lead.source}</span>
            </p>
            {lead.message && (
              <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                Message: <span style={{ color: "var(--adm-text)" }}>{lead.message}</span>
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Assignment" action={<UserCircle size={16} style={{ color: "var(--adm-text-muted)" }} />}>
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--adm-text)" }}>
              {assignedStaff ? assignedStaff.name || assignedStaff.email : "Unassigned"}
            </p>
            {(user?.role === "manager" || user?.role === "admin") && (
              <FilterSelect
                label="Reassign to"
                value=""
                onChange={(e) => handleAssign(e.target.value)}
                className="w-full"
                disabled={savingAssign}
              >
                <option value="">{savingAssign ? "Assigning…" : "Assign / reassign…"}</option>
                {staffData?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </FilterSelect>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Tags" action={<TagIcon size={16} style={{ color: "var(--adm-text-muted)" }} />}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {leadTags.length === 0 && (
                <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  No tags yet.
                </span>
              )}
              {leadTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  disabled={savingTags}
                  className="adm-chip adm-focus-ring"
                  style={{ background: `${tag.color}22`, color: tag.color }}
                >
                  {tag.label} ×
                </button>
              ))}
            </div>
            {allTags.filter((t) => !lead.tags.includes(t.id)).length > 0 && (
              <FilterSelect label="Add tag" value="" onChange={(e) => toggleTag(e.target.value)} className="w-full" disabled={savingTags}>
                <option value="">
                  <Plus size={12} /> Add tag…
                </option>
                {allTags
                  .filter((t) => !lead.tags.includes(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
              </FilterSelect>
            )}
          </div>
        </SectionCard>
      </div>

      {fieldsData && fieldsData.definitions.length > 0 && (
        <SectionCard title="Custom Fields">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fieldsData.definitions.map((def) => (
              <div key={def.id}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                  {def.label}
                </p>
                <p className="text-sm" style={{ color: "var(--adm-text)" }}>
                  {formatCustomFieldValue(lead.customFields[def.key])}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <LeadAttachmentsSection leadId={leadId} />

      <LeadMeetingsSection leadId={leadId} leadEmail={lead.email} leadName={lead.name} />
      <LeadAppointmentsSection leadId={leadId} />

      <AiInsightsSection leadId={leadId} />

      <div>
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Lead detail sections">
          {(["timeline", "tasks"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="adm-focus-ring rounded-[var(--adm-radius-md)] px-3.5 py-2 text-sm font-medium capitalize transition-colors"
              style={
                tab === t
                  ? { background: "var(--adm-accent-soft)", color: "var(--adm-accent)" }
                  : { color: "var(--adm-text-secondary)" }
              }
            >
              {t === "timeline" ? "Timeline" : "Tasks"}
            </button>
          ))}
        </div>
        {tab === "timeline" ? <TimelineTab leadId={leadId} /> : <TasksTab leadId={leadId} />}
      </div>
    </div>
  );
}

function formatCustomFieldValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
