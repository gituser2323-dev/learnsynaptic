/**
 * Shared scheduling infrastructure — public surface. `registerJobHandler`
 * is exported for job-producing modules to call from their own
 * bootstrap registration (see lib/services/scheduler/bootstrap.ts's
 * dynamic-import list); the registry's internal Map and
 * `getJobHandler()` (the scheduler's own lookup) are not exported —
 * only the scheduler itself resolves a job type to a handler.
 */
export { enqueueJob, runDueScheduledJobs, listScheduledJobs, retryScheduledJob, cancelScheduledJob, getQueueMetrics } from "./schedulerService";
export { registerJobHandler } from "./registry";
export type {
  ScheduledJob,
  ScheduledJobStatus,
  ScheduledJobListFilters,
  CreateScheduledJobInput,
  ScheduledJobRepository,
  SchedulerRetryPolicy,
  JobOutcome,
  JobHandler,
  QueueMetrics,
} from "./types";
