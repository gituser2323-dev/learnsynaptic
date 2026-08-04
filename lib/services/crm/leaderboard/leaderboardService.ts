import { authService } from "@/lib/services/auth";
import { leadService } from "@/lib/services/leads";
import { taskService } from "@/lib/services/crm/tasks";
import { activityService } from "@/lib/services/crm/activities";
import type { CounsellorStats, LeaderboardResult } from "./types";

const MAX_ROWS_PER_COUNSELLOR = 500;

function hoursBetween(earlier: string, later: string): number {
  return (new Date(later).getTime() - new Date(earlier).getTime()) / 3_600_000;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** First non-system Activity on a lead approximates "when a counsellor
 *  actually responded" — a note/call/meeting/email is a deliberate human
 *  action, unlike a "system" entry (status change, auto-assignment).
 *  N+1 across a counsellor's own lead list, not the whole table — see
 *  this module's own comment in index.ts on why that's an acceptable
 *  tradeoff here rather than a reason to extend ActivityRepository. */
async function firstResponseHours(leadId: string, leadCreatedAt: string): Promise<number | null> {
  const timeline = await activityService.listTimeline({ entityType: "Lead", entityId: leadId }, 1, 100);
  const humanEntries = timeline.items.filter((a) => a.type !== "system");
  if (humanEntries.length === 0) return null;
  const earliest = humanEntries.reduce((min, a) => (a.createdAt < min ? a.createdAt : min), humanEntries[0].createdAt);
  return hoursBetween(leadCreatedAt, earliest);
}

export const leaderboardService = {
  /** Enterprise CRM (Phase 1) — module 1.6's Leaderboard + Response
   *  Time + Conversion + Productivity dashboard, all one read: every
   *  active staff member's assigned-lead conversion rate, average
   *  first-response time, and task completion/turnaround. Computed on
   *  read (not cached) — same choice lib/services/marketing already
   *  made for the Analytics page's funnels, appropriate at this data
   *  volume; revisit if this ever needs to run against a large org. */
  async getLeaderboard(): Promise<LeaderboardResult> {
    const staff = await authService.listActiveStaff();

    const counsellors: CounsellorStats[] = await Promise.all(
      staff.map(async (user): Promise<CounsellorStats> => {
        const [leads, tasks] = await Promise.all([
          leadService.listLeads({ assignedCounsellorId: user.id }, 1, MAX_ROWS_PER_COUNSELLOR),
          taskService.listTasks({ assigneeId: user.id }, 1, MAX_ROWS_PER_COUNSELLOR),
        ]);

        const convertedLeads = leads.items.filter((l) => l.status === "registered");
        const responseTimes = (
          await Promise.all(leads.items.map((l) => firstResponseHours(l.id, l.createdAt)))
        ).filter((h): h is number => h !== null);

        const openTasks = tasks.items.filter((t) => t.status === "open");
        const completedTasks = tasks.items.filter((t) => t.status === "completed");
        const now = Date.now();
        const overdueTasks = openTasks.filter((t) => new Date(t.dueAt).getTime() < now);
        const turnaroundHours = completedTasks
          .filter((t) => t.completedAt)
          .map((t) => hoursBetween(t.createdAt, t.completedAt as string));

        return {
          counsellorId: user.id,
          name: user.name ?? user.email,
          email: user.email,
          assignedLeadsCount: leads.total,
          convertedLeadsCount: convertedLeads.length,
          conversionRate: leads.total === 0 ? 0 : (convertedLeads.length / leads.total) * 100,
          avgResponseTimeHours: average(responseTimes),
          openTasksCount: openTasks.length,
          overdueTasksCount: overdueTasks.length,
          completedTasksCount: completedTasks.length,
          taskCompletionRate:
            openTasks.length + completedTasks.length === 0
              ? 0
              : (completedTasks.length / (openTasks.length + completedTasks.length)) * 100,
          avgTaskTurnaroundHours: average(turnaroundHours),
        };
      }),
    );

    counsellors.sort((a, b) => b.conversionRate - a.conversionRate);
    return { counsellors, generatedAt: new Date().toISOString() };
  },
};
