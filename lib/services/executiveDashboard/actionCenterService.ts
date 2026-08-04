import { getPaymentRepository } from "@/lib/db";
import { taskService } from "@/lib/services/crm/tasks";
import { leadService } from "@/lib/services/leads";
import { pipelineService } from "@/lib/services/crm/pipelines";
import type { Opportunity } from "@/lib/services/crm/pipelines";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";
import { webhookService } from "@/lib/services/webhooks";
import { integrationService } from "@/lib/services/integrations";
import { getWorkflowPerformance } from "@/lib/services/automation/analytics";
import type { ActionCenterCategoryResult, ActionCenterResult, DateRange } from "./types";

const PREVIEW_LIMIT = 5;

/** No "stalled" flag exists anywhere in this app's data model — this is
 *  the one genuinely new judgment call this module makes, not a
 *  fabricated metric: an open Opportunity that hasn't moved stage in
 *  this many days is surfaced as needing attention. A real, disclosed
 *  threshold, not a stored business rule. */
const STALLED_THRESHOLD_DAYS = 14;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/** Same real-transition-timestamp logic as
 *  lib/services/revenueAnalytics/funnelService.ts's own
 *  enteredCurrentStageAt — duplicated rather than imported (the "three
 *  similar lines" judgment call already established across that
 *  module's own files, not worth a shared abstraction for a 3-line
 *  pure helper). */
function enteredCurrentStageAt(opportunity: Opportunity): string {
  const entry = [...opportunity.stageHistory].reverse().find((e) => e.stageId === opportunity.stageId);
  return entry?.enteredAt ?? opportunity.updatedAt;
}

/**
 * Enterprise Analytics (Phase 7), module 7.3 — Action Center. See
 * ./types.ts's own module doc: every category is a thin composition
 * over an already-existing service/repository read, not a second
 * analytics engine.
 */
export async function getActionCenter(range: DateRange): Promise<ActionCenterResult> {
  const now = new Date();

  const [overdueTasksPage, hotLeadsPage, openOpportunities, failedPaymentsPage, messageCounts, workflowPerformance, autoDisabledEndpointsPage, integrations] =
    await Promise.all([
      taskService.listTasks({ status: "open", dueBefore: now.toISOString() }, 1, PREVIEW_LIMIT),
      leadService.listLeads({ health: "hot" }, 1, PREVIEW_LIMIT * 2), // over-fetch — some are filtered out below (already closed/registered).
      pipelineService.listOpportunities({ status: "open" }),
      (await getPaymentRepository()).list({ status: "failed", createdAfter: range.from, createdBefore: range.to }, 1, PREVIEW_LIMIT),
      whatsappCampaignService.getOverallMessageStats(),
      getWorkflowPerformance(range),
      webhookService.listEndpoints({ status: "auto_disabled" }, 1, PREVIEW_LIMIT),
      integrationService.listIntegrations(),
    ]);

  const hotLeads = hotLeadsPage.items.filter((l) => l.status !== "closed" && l.status !== "registered").slice(0, PREVIEW_LIMIT);
  const hotLeadsTotal = hotLeadsPage.total; // disclosed approximation: the exclusion filter above only applies to this page's own items, not the total count — see this category's own href for the full, correctly-filterable list.

  const stalledCutoff = daysAgo(STALLED_THRESHOLD_DAYS).toISOString();
  const stalledOpportunities = openOpportunities
    .filter((o) => enteredCurrentStageAt(o) <= stalledCutoff)
    .sort((a, b) => enteredCurrentStageAt(a).localeCompare(enteredCurrentStageAt(b)));

  const failedWorkflows = workflowPerformance.workflows.filter((w) => w.failures > 0).sort((a, b) => b.failures - a.failures);

  const integrationIssues = integrations.filter((i) => i.health === "error");

  const categories: ActionCenterCategoryResult[] = [
    {
      category: "overdueTasks",
      label: "Overdue Tasks",
      count: overdueTasksPage.total,
      href: "/admin/tasks",
      items: overdueTasksPage.items.map((t) => ({
        id: t.id,
        label: t.title,
        detail: `Due ${new Date(t.dueAt).toLocaleDateString("en-IN")}`,
        href: "/admin/tasks",
      })),
    },
    {
      category: "hotLeads",
      label: "Hot Leads Awaiting Follow-up",
      count: hotLeadsTotal,
      href: "/admin/leads?health=hot",
      items: hotLeads.map((l) => ({
        id: l.id,
        label: l.name,
        detail: `${l.status} · score ${l.score}`,
        href: `/admin/leads/${l.id}`,
      })),
    },
    {
      category: "stalledOpportunities",
      label: "Stalled Opportunities",
      count: stalledOpportunities.length,
      href: "/admin/pipeline",
      items: stalledOpportunities.slice(0, PREVIEW_LIMIT).map((o) => ({
        id: o.id,
        label: o.expectedRevenueInr ? `₹${o.expectedRevenueInr.toLocaleString("en-IN")} deal` : "Open deal",
        detail: `No movement since ${new Date(enteredCurrentStageAt(o)).toLocaleDateString("en-IN")}`,
        href: "/admin/pipeline",
      })),
    },
    {
      category: "failedPayments",
      label: "Failed Payments",
      count: failedPaymentsPage.total,
      href: "/admin/payments?status=failed",
      items: failedPaymentsPage.items.map((p) => ({
        id: p.id,
        label: p.purpose,
        detail: `₹${(p.amountInSmallestUnit / 100).toLocaleString("en-IN")} · ${p.provider}${p.failureReason ? ` · ${p.failureReason}` : ""}`,
        href: "/admin/payments",
      })),
    },
    {
      category: "failedWhatsAppMessages",
      label: "Failed WhatsApp Messages",
      count: messageCounts.failed,
      href: "/admin/whatsapp",
      items: [],
    },
    {
      category: "failedAutomations",
      label: "Automations Needing Attention",
      count: failedWorkflows.length,
      href: "/admin/automation",
      items: failedWorkflows.slice(0, PREVIEW_LIMIT).map((w) => ({
        id: w.workflowId,
        label: w.workflowName,
        detail: `${w.failures} failure${w.failures === 1 ? "" : "s"} · ${w.errorRatePct === null ? "—" : `${Math.round(w.errorRatePct)}% error rate`}`,
        href: "/admin/automation",
      })),
    },
    {
      category: "webhookFailures",
      label: "Auto-Disabled Webhook Endpoints",
      count: autoDisabledEndpointsPage.total,
      href: "/admin/settings",
      items: autoDisabledEndpointsPage.items.map((e) => ({
        id: e.id,
        label: e.name,
        detail: `${e.consecutiveFailures} consecutive failures${e.lastFailureReason ? ` · ${e.lastFailureReason}` : ""}`,
        href: "/admin/settings",
      })),
    },
    {
      category: "integrationHealthIssues",
      label: "Integration Health Issues",
      count: integrationIssues.length,
      href: "/admin/settings",
      items: integrationIssues.slice(0, PREVIEW_LIMIT).map((i) => ({
        id: i.provider.id,
        label: i.provider.name,
        detail: i.lastError ?? "Connection error",
        href: "/admin/settings",
      })),
    },
  ];

  return {
    range,
    totalCount: categories.reduce((sum, c) => sum + c.count, 0),
    categories,
  };
}
