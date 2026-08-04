import { getWorkflowPerformance } from "@/lib/services/automation/analytics";
import type { AutomationRoiEntry, AutomationRoiSummary } from "./automationRoiTypes";
import type { DateRange } from "./types";

/**
 * Enterprise Analytics (Phase 7), module 7.2 — Automation ROI (mission
 * §9). A reshape of workflowPerformanceService's own already-computed
 * per-workflow join (mission §2) into the ROI-specific vocabulary the
 * mission names, plus one genuinely new figure: account-wide totals
 * (workflowPerformanceService returns per-workflow rows only). See
 * ./automationRoiTypes.ts's own doc for why those totals are plain
 * sums, not deduplicated.
 */
export async function getAutomationRoi(range: DateRange): Promise<AutomationRoiSummary> {
  const performance = await getWorkflowPerformance(range);

  const workflows: AutomationRoiEntry[] = performance.workflows.map((w) => ({
    workflowId: w.workflowId,
    workflowName: w.workflowName,
    executions: w.runs,
    leadsInfluenced: w.entitiesAffected,
    conversionsInfluenced: w.conversions,
    messagesSent: w.messagesSent,
    revenueInfluencedInr: w.revenueInfluencedInr,
    revenueDirectInr: w.revenueAttributedInr,
  }));

  const totals = workflows.reduce(
    (acc, w) => ({
      executions: acc.executions + w.executions,
      leadsInfluenced: acc.leadsInfluenced + w.leadsInfluenced,
      conversionsInfluenced: acc.conversionsInfluenced + w.conversionsInfluenced,
      messagesSent: acc.messagesSent + w.messagesSent,
      revenueInfluencedInr: acc.revenueInfluencedInr + w.revenueInfluencedInr,
      revenueDirectInr: acc.revenueDirectInr + w.revenueDirectInr,
    }),
    { executions: 0, leadsInfluenced: 0, conversionsInfluenced: 0, messagesSent: 0, revenueInfluencedInr: 0, revenueDirectInr: 0 },
  );

  return { range, totals, workflows };
}
