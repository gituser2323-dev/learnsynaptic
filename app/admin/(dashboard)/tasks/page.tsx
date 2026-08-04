"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Plus, ChevronLeft, ChevronRight, List, CalendarDays } from "lucide-react";
import { listTasks, createTask, completeTask, reassignTask, listStaff } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { Badge, taskPriorityTone } from "@/components/admin/Badge";
import { FormField } from "@/components/admin/FormField";
import { FilterSelect } from "@/components/admin/FilterControls";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { TableSkeleton } from "@/components/admin/Skeleton";
import type { Task, TaskListFilters, TaskPriority, TaskRecurrence, TaskStatus } from "@/lib/services/crm/tasks";

const PAGE_SIZE = 20;
const CALENDAR_PAGE_SIZE = 500;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRIORITY_DOT_COLOR: Record<TaskPriority, string> = {
  high: "var(--adm-danger)",
  medium: "var(--adm-warning)",
  low: "var(--adm-info)",
};

function isTaskOverdue(task: Task): boolean {
  return task.status === "open" && new Date(task.dueAt).getTime() < Date.now();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Full 6-row grid so every month renders a stable height — includes the
 *  trailing days of the previous/next month (dimmed), same convention
 *  as every consumer calendar UI. */
function buildCalendarGrid(monthStart: Date): Date[] {
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

/**
 * Enterprise CRM (Phase 1) — Task Management's calendar view. Reuses the
 * same `listTasks` endpoint as the list view (its dueBefore/dueAfter
 * filters already existed server-side, unused by any UI until now) —
 * fetched once per visible month rather than paginated, since a single
 * counsellor's or team's monthly task volume is bounded. A plain CSS
 * grid, not a calendar library — same "don't add a dependency without
 * real justification" call the Pipeline board's native drag-and-drop
 * already made.
 */
function CalendarView({
  monthStart,
  tasks,
  loading,
  onChanged,
}: {
  monthStart: Date;
  tasks: Task[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const days = buildCalendarGrid(monthStart);
  const today = new Date();

  return (
    <div className="adm-card overflow-hidden p-0">
      <div className="grid grid-cols-7" style={{ borderBottom: "1px solid var(--adm-border)" }}>
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--adm-text-muted)" }}
          >
            {label}
          </div>
        ))}
      </div>
      {loading ? (
        <div className="p-6">
          <TableSkeleton rows={4} columns={7} />
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = day.getMonth() === monthStart.getMonth();
            const dayKey = day.toDateString();
            const dayTasks = tasks
              .filter((t) => isSameDay(new Date(t.dueAt), day))
              .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
            const expanded = expandedDay === dayKey;
            const visible = expanded ? dayTasks : dayTasks.slice(0, 3);

            return (
              <div
                key={dayKey}
                className="min-h-[110px] p-1.5"
                style={{
                  borderRight: "1px solid var(--adm-border)",
                  borderBottom: "1px solid var(--adm-border)",
                  background: inMonth ? "transparent" : "var(--adm-surface-2)",
                  opacity: inMonth ? 1 : 0.5,
                }}
              >
                <p
                  className="mb-1 px-1 text-xs font-medium"
                  style={{
                    color: isSameDay(day, today) ? "var(--adm-accent)" : "var(--adm-text-muted)",
                    fontWeight: isSameDay(day, today) ? 700 : 500,
                  }}
                >
                  {day.getDate()}
                </p>
                <div className="space-y-1">
                  {visible.map((task) => {
                    const overdue = isTaskOverdue(task);
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => (task.status === "open" ? completeTask(task.id).then(onChanged) : undefined)}
                        title={`${task.title}${overdue ? " — overdue" : ""} — click to mark complete`}
                        className="adm-focus-ring flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px]"
                        style={{
                          background: overdue ? "var(--adm-danger-soft)" : "var(--adm-surface-2)",
                          color: task.status === "completed" ? "var(--adm-text-muted)" : overdue ? "var(--adm-danger)" : "var(--adm-text)",
                          textDecoration: task.status === "completed" ? "line-through" : "none",
                          fontWeight: overdue ? 600 : 400,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: PRIORITY_DOT_COLOR[task.priority] }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{task.title}</span>
                      </button>
                    );
                  })}
                  {!expanded && dayTasks.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(dayKey)}
                      className="adm-focus-ring px-1 text-[11px] font-medium"
                      style={{ color: "var(--adm-accent)" }}
                    >
                      +{dayTasks.length - 3} more
                    </button>
                  )}
                  {expanded && dayTasks.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setExpandedDay(null)}
                      className="adm-focus-ring px-1 text-[11px] font-medium"
                      style={{ color: "var(--adm-text-muted)" }}
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Enterprise CRM (Phase 1) — Task Management. Both "Lead Tasks" (a task
 * with entityType: "Lead") and "Counsellor Tasks" (no entity link, a
 * purely personal follow-up) render here identically — the Lead ones
 * also appear on their own Lead's detail page (a filtered view of this
 * same data, not a separate concept). Reminders themselves fire via the
 * shared scheduler (see lib/services/crm/tasks/schedulerIntegration.ts)
 * — this page is where a human creates/completes/reassigns, not where
 * the reminder itself is configured.
 */
function TaskRow({ task, onChanged }: { task: Task; onChanged: () => void }) {
  const { user } = useAdminAuth();
  const canReassign = user?.role === "manager" || user?.role === "admin";
  const { data: staff } = useAdminData(() => listStaff(), []);
  const isOverdue = isTaskOverdue(task);

  return (
    <div className="adm-card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-medium"
          style={{ color: task.status === "completed" ? "var(--adm-text-muted)" : "var(--adm-text)" }}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--adm-text-muted)" }}>
          <Badge tone={taskPriorityTone(task.priority)}>{task.priority}</Badge>
          {task.recurrence !== "none" && <Badge tone="neutral">{task.recurrence}</Badge>}
          {isOverdue && <Badge tone="danger">overdue</Badge>}
          <span>Due {new Date(task.dueAt).toLocaleString()}</span>
          {task.entityType === "Lead" && (
            <Link href={`/admin/leads/${task.entityId}`} className="underline" style={{ color: "var(--adm-accent)" }}>
              View lead
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {task.status === "open" && canReassign && (
          <FilterSelect
            label="Reassign"
            value={task.assigneeId}
            onChange={(e) => reassignTask(task.id, e.target.value).then(onChanged)}
            className="w-40"
          >
            {staff?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </FilterSelect>
        )}
        {task.status === "open" ? (
          <button type="button" onClick={() => completeTask(task.id).then(onChanged)} className="adm-focus-ring adm-btn adm-btn-secondary">
            Complete
          </button>
        ) : (
          <Badge tone="success">Done</Badge>
        )}
      </div>
    </div>
  );
}

function CreateTaskForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAdminAuth();
  const canAssignOthers = user?.role === "manager" || user?.role === "admin";
  const { data: staff } = useAdminData(() => listStaff(), []);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  // A counsellor can only ever create a task for themselves (the API
  // force-overrides assigneeId server-side either way — see
  // /api/admin/crm/tasks's own RBAC comment) — default straight to that
  // rather than showing a picker whose only valid answer is "you." A
  // conditional setState in the render body, not an effect — React's own
  // documented "reset/sync state when a dependency changes" pattern (see
  // useAdminData.ts's own comment on why this codebase uses this shape
  // instead of the set-state-in-effect lint rule's rejected alternative).
  const [assigneeId, setAssigneeId] = useState(canAssignOthers ? "" : (user?.id ?? ""));
  const [syncedForUserId, setSyncedForUserId] = useState(user?.id);
  if (!canAssignOthers && user?.id && syncedForUserId !== user.id) {
    setSyncedForUserId(user.id);
    setAssigneeId(user.id);
  }
  const [recurrence, setRecurrence] = useState<TaskRecurrence>("none");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !dueAt || !assigneeId) return;
    setSubmitting(true);
    const result = await createTask({ title: title.trim(), dueAt: new Date(dueAt).toISOString(), priority, assigneeId, recurrence });
    setSubmitting(false);
    if (result.success) {
      setTitle("");
      setDueAt("");
      setOpen(false);
      onCreated();
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="adm-focus-ring adm-btn adm-btn-primary">
        <Plus size={15} /> New Task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="adm-card space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="new-task-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <FormField id="new-task-due" label="Due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
      </div>
      <div className="flex flex-wrap gap-3">
        <FilterSelect label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="w-32">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </FilterSelect>
        <FilterSelect label="Recurrence" value={recurrence} onChange={(e) => setRecurrence(e.target.value as TaskRecurrence)} className="w-36">
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </FilterSelect>
        {canAssignOthers ? (
          <FilterSelect label="Assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-56">
            <option value="">Assign to…</option>
            {staff?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </FilterSelect>
        ) : (
          <p className="flex items-center text-xs" style={{ color: "var(--adm-text-muted)" }}>
            Assigned to you
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={submitting || !title.trim() || !dueAt || !assigneeId} className="adm-focus-ring adm-btn adm-btn-primary">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Create
        </button>
        <button type="button" onClick={() => setOpen(false)} className="adm-focus-ring adm-btn adm-btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function AdminTasksPage() {
  const { user } = useAdminAuth();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [status, setStatus] = useState<TaskStatus | "">("open");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [assigneeId, setAssigneeId] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const { data: staff } = useAdminData(() => listStaff(), []);

  const listFilters: TaskListFilters = {
    status: status || undefined,
    priority: priority || undefined,
    assigneeId: assigneeId || undefined,
  };
  const {
    data: listData,
    loading: listLoading,
    error: listError,
    forbidden: listForbidden,
    reload: reloadList,
  } = useAdminData(() => listTasks(listFilters, 1, PAGE_SIZE), [view, status, priority, assigneeId]);

  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  const calendarFilters: TaskListFilters = {
    priority: priority || undefined,
    assigneeId: assigneeId || undefined,
    dueAfter: calendarMonth.toISOString(),
    dueBefore: monthEnd.toISOString(),
  };
  const {
    data: calendarData,
    loading: calendarLoading,
    forbidden: calendarForbidden,
    reload: reloadCalendar,
  } = useAdminData(
    () => listTasks(calendarFilters, 1, CALENDAR_PAGE_SIZE),
    [view, priority, assigneeId, calendarMonth.getTime()],
  );

  const forbidden = view === "list" ? listForbidden : calendarForbidden;
  const reload = view === "list" ? reloadList : reloadCalendar;

  return (
    <div className="space-y-6">
      <div className="adm-animate-in flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="!text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
            Tasks
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Follow-ups and reminders — for a lead, or a counsellor&apos;s own queue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="adm-card flex gap-1 p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className="adm-focus-ring flex items-center gap-1.5 rounded-[var(--adm-radius-sm)] px-2.5 py-1.5 text-xs font-medium"
              style={{
                background: view === "list" ? "var(--adm-accent-soft)" : "transparent",
                color: view === "list" ? "var(--adm-accent)" : "var(--adm-text-secondary)",
              }}
            >
              <List size={14} /> List
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className="adm-focus-ring flex items-center gap-1.5 rounded-[var(--adm-radius-sm)] px-2.5 py-1.5 text-xs font-medium"
              style={{
                background: view === "calendar" ? "var(--adm-accent-soft)" : "transparent",
                color: view === "calendar" ? "var(--adm-accent)" : "var(--adm-text-secondary)",
              }}
            >
              <CalendarDays size={14} /> Calendar
            </button>
          </div>
          <CreateTaskForm onCreated={reload} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {view === "list" && (
          <FilterSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")} className="w-36">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="completed">Completed</option>
          </FilterSelect>
        )}
        <FilterSelect label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority | "")} className="w-36">
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </FilterSelect>
        <FilterSelect label="Assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-56">
          <option value="">Everyone</option>
          {staff?.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
        </FilterSelect>

        {view === "calendar" && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="adm-focus-ring adm-icon-btn"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="min-w-[9rem] text-center text-sm font-medium" style={{ color: "var(--adm-text)" }}>
              {monthLabel(calendarMonth)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="adm-focus-ring adm-icon-btn"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {forbidden && <ForbiddenState role={user?.role} />}

      {!forbidden && view === "list" && (
        <>
          {listLoading && <TableSkeleton rows={5} columns={3} />}
          {!listLoading && (listError || !listData) && <ErrorState message={listError ?? "Could not load tasks."} onRetry={reloadList} />}
          {!listLoading && !listError && listData && listData.items.length === 0 && <EmptyState message="No tasks match these filters." />}
          {!listLoading && !listError && listData && listData.items.length > 0 && (
            <div className="space-y-2">
              {listData.items.map((task) => (
                <TaskRow key={task.id} task={task} onChanged={reloadList} />
              ))}
            </div>
          )}
        </>
      )}

      {!forbidden && view === "calendar" && (
        <CalendarView
          monthStart={calendarMonth}
          tasks={calendarData?.items ?? []}
          loading={calendarLoading}
          onChanged={reloadCalendar}
        />
      )}
    </div>
  );
}
