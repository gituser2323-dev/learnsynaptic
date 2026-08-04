/** Counsellor Leaderboard domain layer — Enterprise CRM (Phase 1),
 *  module 1.6's "Leaderboard (conversion, response time)" and
 *  productivity dashboard. Not a persisted collection — every figure
 *  here is derived on read from Lead/Task/Activity, the same "live
 *  aggregation" shape lib/services/marketing already uses for the
 *  Analytics page's funnels, not a new denormalized rollup table. */

export interface CounsellorStats {
  counsellorId: string;
  name: string;
  email: string;
  assignedLeadsCount: number;
  convertedLeadsCount: number;
  /** 0–100. */
  conversionRate: number;
  /** Average hours between a lead's creation and the first non-system
   *  activity logged on it (note/call/meeting/email) — null if this
   *  counsellor has no leads with a logged first response yet. */
  avgResponseTimeHours: number | null;
  openTasksCount: number;
  overdueTasksCount: number;
  completedTasksCount: number;
  /** 0–100. */
  taskCompletionRate: number;
  /** Average hours between a task's creation and its completion — null
   *  if this counsellor has no completed tasks yet. */
  avgTaskTurnaroundHours: number | null;
}

export interface LeaderboardResult {
  counsellors: CounsellorStats[];
  generatedAt: string;
}
