"use client";

import { useState } from "react";
import { Trophy, Workflow, Zap, IndianRupee, Download } from "lucide-react";
import {
  getMarketing,
  getWhatsAppMessageStats,
  getLeaderboard,
  getPipelineAnalytics,
  getRevenueAnalytics,
  exportRevenueAnalyticsCsv,
  type AdminMarketingResponse,
  type RevenueAnalyticsCsvSection,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { FormField } from "@/components/admin/FormField";
import { StatCard } from "@/components/admin/StatCard";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Badge } from "@/components/admin/Badge";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { StatCardsSkeleton, TableSkeleton } from "@/components/admin/Skeleton";
import { FunnelViz } from "@/components/admin/charts/FunnelViz";
import { DonutStat } from "@/components/admin/charts/DonutStat";
import { TrendLine } from "@/components/admin/charts/TrendLine";
import { DateRangePicker, type DateRangeSelection } from "@/components/admin/DateRangePicker";
import { formatCurrencyInr, formatNumber, formatPercent } from "@/components/admin/format";
import type { CampaignMarketingMetrics } from "@/lib/services/marketing";
import type { MessageStatusCounts } from "@/lib/services/whatsappCampaigns";
import type { CounsellorStats } from "@/lib/services/crm/leaderboard";
import type { CounsellorPipelineStats, StageFunnelEntry } from "@/lib/services/crm/pipelineAnalytics";
import type { WorkflowPerformanceEntry } from "@/lib/services/automation/analytics";
import type {
  AttributionDimension,
  CounsellorRevenueStats,
  CampaignRoiEntry,
  WhatsAppCampaignRevenueEntry,
} from "@/lib/services/revenueAnalytics";

function formatPct100(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatHours(value: number | null): string {
  if (value === null) return "—";
  if (value < 1) return `${Math.round(value * 60)}m`;
  if (value < 48) return `${value.toFixed(1)}h`;
  return `${(value / 24).toFixed(1)}d`;
}

const LEADERBOARD_COLUMNS: TableColumn<CounsellorStats>[] = [
  { key: "name", header: "Counsellor", render: (c) => c.name },
  { key: "assigned", header: "Assigned", align: "right", render: (c) => formatNumber(c.assignedLeadsCount) },
  { key: "converted", header: "Converted", align: "right", render: (c) => formatNumber(c.convertedLeadsCount) },
  { key: "conversion", header: "Conversion", align: "right", render: (c) => formatPct100(c.conversionRate) },
  { key: "response", header: "Avg. Response", align: "right", render: (c) => formatHours(c.avgResponseTimeHours) },
  { key: "open", header: "Open Tasks", align: "right", render: (c) => formatNumber(c.openTasksCount) },
  {
    key: "overdue",
    header: "Overdue",
    align: "right",
    render: (c) => (c.overdueTasksCount > 0 ? <Badge tone="danger">{c.overdueTasksCount}</Badge> : formatNumber(0)),
  },
  { key: "completion", header: "Task Completion", align: "right", render: (c) => formatPct100(c.taskCompletionRate) },
  { key: "turnaround", header: "Avg. Turnaround", align: "right", render: (c) => formatHours(c.avgTaskTurnaroundHours) },
];

/** Enterprise CRM (Phase 1), module 1.6 — the Counsellor Leaderboard /
 *  productivity dashboard. Deliberately fetches and gates itself
 *  independently of the rest of this page: `requiredRole: "manager"`
 *  on its own route (the blueprint's own carve-out — "manager rank
 *  sufficient for viewing the leaderboard") is a lower bar than the
 *  admin-only marketing data above it, so a manager who can't see ad
 *  spend must still be able to see this. */
function CounsellorLeaderboardSection() {
  const { user } = useAdminAuth();
  const { data, loading, error, forbidden, reload } = useAdminData(() => getLeaderboard(), []);

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
        <Trophy size={14} /> Counsellor Leaderboard
      </h2>
      {loading && <TableSkeleton rows={4} columns={9} />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load the leaderboard."} onRetry={reload} />
      )}
      {!loading && !forbidden && !error && data && data.counsellors.length === 0 && (
        <EmptyState message="No active staff accounts yet." />
      )}
      {!loading && !forbidden && !error && data && data.counsellors.length > 0 && (
        <Table columns={LEADERBOARD_COLUMNS} rows={data.counsellors} getRowKey={(c) => c.counsellorId} />
      )}
    </section>
  );
}

const COUNSELLOR_PIPELINE_COLUMNS: TableColumn<CounsellorPipelineStats>[] = [
  { key: "name", header: "Counsellor", render: (c) => c.name },
  { key: "open", header: "Open Deals", align: "right", render: (c) => formatNumber(c.openOpportunitiesCount) },
  { key: "won", header: "Won", align: "right", render: (c) => formatNumber(c.wonOpportunitiesCount) },
  { key: "lost", header: "Lost", align: "right", render: (c) => formatNumber(c.lostOpportunitiesCount) },
  {
    key: "winRate",
    header: "Win Rate",
    align: "right",
    render: (c) => (c.winRate === null ? "—" : formatPct100(c.winRate)),
  },
  {
    key: "openValue",
    header: "Open Pipeline Value",
    align: "right",
    render: (c) => formatCurrencyInr(c.openPipelineValueInr),
  },
  {
    key: "avgWonValue",
    header: "Avg. Won Deal",
    align: "right",
    render: (c) => formatCurrencyInr(c.avgWonDealValueInr),
  },
];

function stageFunnelColumns(): TableColumn<StageFunnelEntry>[] {
  return [
    { key: "stage", header: "Stage", render: (s) => s.stageName },
    { key: "entered", header: "Entered", align: "right", render: (s) => formatNumber(s.enteredCount) },
    {
      key: "conversion",
      header: "Conv. from First Stage",
      align: "right",
      render: (s) => (s.conversionFromFirstStage === null ? "—" : formatPct100(s.conversionFromFirstStage)),
    },
    {
      key: "avgTime",
      header: "Avg. Time in Stage",
      align: "right",
      render: (s) => formatHours(s.avgTimeInStageHours),
    },
  ];
}

/** Enterprise Analytics (Phase 7), module 7.1 — Counsellor & Pipeline
 *  Analytics. Distinct data from module 1.6's Leaderboard above (that's
 *  Lead/Task-derived; this is Opportunity/Pipeline-derived), same
 *  self-gating shape: its own fetch, its own `requiredRole: "manager"`
 *  gate on the route, rendered independently of the admin-only marketing
 *  data below it. */
function PipelineAnalyticsSection() {
  const { user } = useAdminAuth();
  const { data, loading, error, forbidden, reload } = useAdminData(() => getPipelineAnalytics(), []);
  const stageColumns = stageFunnelColumns();

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
        <Workflow size={14} /> Counsellor &amp; Pipeline Analytics
      </h2>
      {loading && <TableSkeleton rows={4} columns={7} />}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load pipeline analytics."} onRetry={reload} />
      )}
      {!loading && !forbidden && !error && data && (
        <div className="space-y-6">
          {data.counsellors.length === 0 ? (
            <EmptyState message="No active staff accounts yet." />
          ) : (
            <Table columns={COUNSELLOR_PIPELINE_COLUMNS} rows={data.counsellors} getRowKey={(c) => c.counsellorId} />
          )}
          {data.pipelines.map((pipeline) => (
            <div key={pipeline.pipelineId}>
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--adm-text-secondary)" }}>
                {pipeline.pipelineName}
                {pipeline.program ? ` · ${pipeline.program}` : ""}
              </p>
              <Table columns={stageColumns} rows={pipeline.stages} getRowKey={(s) => s.stageId} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const CAMPAIGN_COLUMNS: TableColumn<CampaignMarketingMetrics>[] = [
  { key: "name", header: "Campaign", render: (c) => c.campaignName },
  { key: "registrations", header: "Registrations", align: "right", render: (c) => formatNumber(c.registrations) },
  {
    key: "spend",
    header: "Ad Spend",
    align: "right",
    render: (c) => (c.ads.dataAvailable ? formatCurrencyInr(c.ads.spend) : "—"),
  },
  {
    key: "impressions",
    header: "Impressions",
    align: "right",
    render: (c) => (c.ads.dataAvailable ? formatNumber(c.ads.impressions) : "—"),
  },
  {
    key: "clicks",
    header: "Clicks",
    align: "right",
    render: (c) => (c.ads.dataAvailable ? formatNumber(c.ads.clicks) : "—"),
  },
  { key: "ctr", header: "CTR", align: "right", render: (c) => formatPercent(c.derived.ctr) },
  { key: "cpc", header: "CPC", align: "right", render: (c) => formatCurrencyInr(c.derived.cpc) },
  { key: "cpa", header: "CPA", align: "right", render: (c) => formatCurrencyInr(c.derived.cpa) },
];

/** RC-1 — every WhatsApp message the app has sent (bulk campaigns and
 *  automation-triggered nurture sends alike), surfaced here for the
 *  first time: this data already existed (Campaign Architecture), it
 *  just had nowhere to roll up outside a single campaign's own detail
 *  page. */
function WhatsAppPerformanceSection() {
  const { data, loading, error, reload } = useAdminData<{ messageCounts: MessageStatusCounts }>(
    () => getWhatsAppMessageStats(),
    [],
  );

  return (
    <section>
      <h2 className="mb-3 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
        WhatsApp Performance
      </h2>
      {loading && <StatCardsSkeleton count={5} />}
      {!loading && (error || !data) && (
        <ErrorState message={error ?? "Could not load WhatsApp performance."} onRetry={reload} />
      )}
      {!loading && !error && data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:col-span-2">
            <StatCard label="Queued" value={data.messageCounts.queued} tone="info" />
            <StatCard label="Sent" value={data.messageCounts.sent} tone="info" />
            <StatCard label="Delivered" value={data.messageCounts.delivered} tone="success" />
            <StatCard label="Read" value={data.messageCounts.read} tone="success" />
            <StatCard label="Failed" value={data.messageCounts.failed} tone="danger" />
          </div>
          <DonutStat
            title="Message Status Mix"
            slices={[
              { label: "Queued", value: data.messageCounts.queued, color: "info" },
              { label: "Sent", value: data.messageCounts.sent, color: "accent2" },
              { label: "Delivered", value: data.messageCounts.delivered, color: "success" },
              { label: "Read", value: data.messageCounts.read, color: "accent" },
              { label: "Failed", value: data.messageCounts.failed, color: "danger" },
            ]}
          />
        </div>
      )}
    </section>
  );
}

function formatHoursShort(value: number | null): string {
  if (value === null) return "—";
  if (value < 1) return `${Math.round(value * 60)}m`;
  if (value < 48) return `${value.toFixed(1)}h`;
  return `${(value / 24).toFixed(1)}d`;
}

function ExportCsvButton({ section, range }: { section: RevenueAnalyticsCsvSection; range: DateRangeSelection }) {
  return (
    <button
      type="button"
      onClick={() => exportRevenueAnalyticsCsv(section, range)}
      className="adm-focus-ring inline-flex items-center gap-1.5 rounded-[var(--adm-radius-sm)] px-2.5 py-1.5 text-xs font-medium"
      style={{ background: "var(--adm-surface-2)", color: "var(--adm-text-secondary)", border: "1px solid var(--adm-line)" }}
    >
      <Download size={12} /> Export CSV
    </button>
  );
}

const WORKFLOW_PERFORMANCE_COLUMNS: TableColumn<WorkflowPerformanceEntry>[] = [
  {
    key: "name",
    header: "Workflow",
    render: (w) => (
      <span className="flex items-center gap-2">
        {w.workflowName}
        {!w.active && <Badge tone="neutral">inactive</Badge>}
      </span>
    ),
  },
  { key: "runs", header: "Runs", align: "right", render: (w) => formatNumber(w.runs) },
  { key: "successes", header: "Successes", align: "right", render: (w) => formatNumber(w.successes) },
  { key: "failures", header: "Failures", align: "right", render: (w) => formatNumber(w.failures) },
  { key: "errorRate", header: "Error Rate", align: "right", render: (w) => formatPct100(w.errorRatePct) },
  { key: "conversions", header: "Conversions", align: "right", render: (w) => formatNumber(w.conversions) },
  { key: "leads", header: "Leads Affected", align: "right", render: (w) => formatNumber(w.entitiesAffected) },
  { key: "messages", header: "Messages Sent", align: "right", render: (w) => formatNumber(w.messagesSent) },
  { key: "tasks", header: "Tasks Created", align: "right", render: (w) => formatNumber(w.tasksCreated) },
  { key: "revInfluenced", header: "Revenue Influenced", align: "right", render: (w) => formatCurrencyInr(w.revenueInfluencedInr) },
  { key: "revAttributed", header: "Revenue Attributed", align: "right", render: (w) => formatCurrencyInr(w.revenueAttributedInr) },
  { key: "avgTime", header: "Avg. Completion", align: "right", render: (w) => formatHoursShort(w.avgCompletionTimeHours) },
  {
    key: "lastRun",
    header: "Last Execution",
    align: "right",
    render: (w) => (w.lastExecutionAt ? new Date(w.lastExecutionAt).toLocaleDateString("en-IN") : "—"),
  },
];

/** Enterprise Analytics (Phase 7), module 7.2 — the automation half of
 *  this module: account-wide KPIs, a per-day trend, and the
 *  per-workflow performance table (best/worst-performing automations
 *  are just this same table sorted differently — no separate view
 *  needed for that). */
function AutomationAnalyticsSection({ range }: { range: DateRangeSelection }) {
  const { user } = useAdminAuth();
  const { data, loading, error, forbidden, reload } = useAdminData(
    () => getRevenueAnalytics(range),
    [range.preset, range.from, range.to],
  );

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
        <Zap size={14} /> Automation Analytics
      </h2>
      {loading && (
        <div className="space-y-4">
          <StatCardsSkeleton count={8} />
          <TableSkeleton rows={4} columns={8} />
        </div>
      )}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && <ErrorState message={error ?? "Could not load automation analytics."} onRetry={reload} />}
      {!loading && !forbidden && !error && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Executions" value={data.automation.executions} tone="accent" />
            <StatCard label="Active Workflows" value={data.automation.activeWorkflowDefinitions} sublabel={`of ${data.automation.totalWorkflowDefinitions} total`} tone="info" />
            <StatCard label="Success Rate" value={formatPct100(data.automation.successRatePct)} tone="success" />
            <StatCard label="Failure Rate" value={formatPct100(data.automation.failureRatePct)} tone="danger" />
            <StatCard label="Retry Rate" value={formatPct100(data.automation.retryRatePct)} tone="warning" />
            <StatCard label="Dead-Letter Count" value={data.automation.deadLetterCount} tone="danger" />
            <StatCard label="Avg. Completion" value={formatHoursShort(data.automation.avgCompletionTimeHours)} tone="info" />
            <StatCard label="Actions Executed" value={data.automation.actionExecutionVolume} tone="accent" />
            <StatCard label="Messages Sent" value={data.automation.automationGeneratedMessages} tone="accent" />
            <StatCard label="Tasks Created" value={data.automation.automationGeneratedTasks} tone="accent" />
            <StatCard label="Conversions" value={data.automation.automationGeneratedConversions} tone="success" />
          </div>

          <TrendLine
            title="Executions Over Time"
            data={data.automation.trend}
            series={[
              { key: "executions", label: "Executions", color: "accent" },
              { key: "completed", label: "Completed", color: "success" },
              { key: "failed", label: "Failed", color: "danger" },
            ]}
            note={
              data.automation.trend.length === 0
                ? "Trend is omitted for ranges longer than 92 days — narrow the date range to see a day-by-day breakdown."
                : undefined
            }
          />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--adm-text-secondary)" }}>
                Workflow Performance
              </p>
              <ExportCsvButton section="workflows" range={range} />
            </div>
            {data.workflowPerformance.workflows.length === 0 ? (
              <EmptyState message="No workflows in the catalog yet." />
            ) : (
              <Table columns={WORKFLOW_PERFORMANCE_COLUMNS} rows={data.workflowPerformance.workflows} getRowKey={(w) => w.workflowId} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

const ATTRIBUTION_DIMENSION_LABELS: Record<AttributionDimension["dimension"], string> = {
  leadSource: "Lead Source",
  utmSource: "UTM Source",
  utmMedium: "UTM Medium",
  utmCampaign: "UTM Campaign",
  marketingCampaign: "Marketing Campaign",
  whatsappCampaign: "WhatsApp Campaign",
  automationWorkflow: "Automation Workflow",
  counsellor: "Counsellor",
  program: "Program",
  pipeline: "Pipeline",
};

const COUNSELLOR_REVENUE_COLUMNS: TableColumn<CounsellorRevenueStats>[] = [
  { key: "name", header: "Counsellor", render: (c) => c.name },
  { key: "leads", header: "Leads Assigned", align: "right", render: (c) => formatNumber(c.leadsAssignedCount) },
  { key: "conversations", header: "Conversations", align: "right", render: (c) => formatNumber(c.conversationsAssignedCount) },
  { key: "response", header: "Avg. Response", align: "right", render: (c) => formatHoursShort(c.avgResponseTimeHours) },
  { key: "conversionRate", header: "Conversion Rate", align: "right", render: (c) => formatPct100(c.conversionRatePct) },
  { key: "won", header: "Won Deals", align: "right", render: (c) => formatNumber(c.wonOpportunitiesCount) },
  { key: "winRate", header: "Win Rate", align: "right", render: (c) => formatPct100(c.winRatePct) },
  { key: "avgDeal", header: "Avg. Deal Value", align: "right", render: (c) => formatCurrencyInr(c.avgWonDealValueInr) },
  { key: "revenue", header: "Revenue", align: "right", render: (c) => formatCurrencyInr(c.revenueInr) },
];

const CAMPAIGN_ROI_COLUMNS: TableColumn<CampaignRoiEntry>[] = [
  { key: "name", header: "Campaign", render: (c) => c.campaignName },
  {
    key: "spend",
    header: "Spend",
    align: "right",
    render: (c) => (
      <span>
        {formatCurrencyInr(c.spendInr)}
        {c.spendSource === "budget_field" && <span className="ml-1 text-[10px]" style={{ color: "var(--adm-text-muted)" }}>(budget)</span>}
      </span>
    ),
  },
  { key: "leads", header: "Leads", align: "right", render: (c) => (c.leadMatchAvailable ? formatNumber(c.leads) : "—") },
  { key: "registrations", header: "Registrations", align: "right", render: (c) => formatNumber(c.registrationsInRange) },
  { key: "conversions", header: "Conversions", align: "right", render: (c) => formatNumber(c.conversions) },
  { key: "revenue", header: "Revenue", align: "right", render: (c) => formatCurrencyInr(c.revenueInr) },
  { key: "cpl", header: "CPL", align: "right", render: (c) => formatCurrencyInr(c.cpl) },
  { key: "cpa", header: "CPA", align: "right", render: (c) => formatCurrencyInr(c.cpa) },
  { key: "roas", header: "ROAS", align: "right", render: (c) => (c.roas === null ? "—" : `${c.roas.toFixed(2)}x`) },
  {
    key: "roi",
    header: "ROI",
    align: "right",
    render: (c) => (c.roiPct === null ? "—" : <Badge tone={c.roiPct >= 0 ? "success" : "danger"}>{c.roiPct.toFixed(0)}%</Badge>),
  },
];

const WHATSAPP_REVENUE_COLUMNS: TableColumn<WhatsAppCampaignRevenueEntry>[] = [
  { key: "name", header: "Campaign", render: (c) => c.campaignName },
  { key: "sent", header: "Sent", align: "right", render: (c) => formatNumber(c.sentCount) },
  { key: "delivered", header: "Delivered", align: "right", render: (c) => formatPct100(c.deliveryRatePct) },
  { key: "read", header: "Read", align: "right", render: (c) => formatPct100(c.readRatePct) },
  { key: "reply", header: "Reply Rate", align: "right", render: (c) => formatPct100(c.replyRatePct) },
  { key: "failed", header: "Failed", align: "right", render: (c) => formatNumber(c.failedCount) },
  { key: "conversions", header: "Conversions", align: "right", render: (c) => formatNumber(c.conversions) },
  { key: "conversionRate", header: "Conv. Rate", align: "right", render: (c) => formatPct100(c.conversionRatePct) },
  { key: "revenue", header: "Revenue", align: "right", render: (c) => formatCurrencyInr(c.revenueInr) },
];

/** Enterprise Analytics (Phase 7), module 7.2 — Revenue Analytics,
 *  Attribution, the extended CRM Funnel, Counsellor + Revenue, Campaign
 *  ROI, and WhatsApp Performance + Revenue: every remaining mission
 *  section, sharing one fetch/date-range with AutomationAnalyticsSection
 *  above (both call the same composed /api/admin/analytics/revenue
 *  endpoint — React Query-style de-duplication isn't set up in this
 *  codebase, so this is two real network calls per range change, the
 *  same "prefer straightforward over premature" tradeoff every other
 *  page in this dashboard already accepts for its own N independent
 *  sections). */
function RevenueAnalyticsSection({ range }: { range: DateRangeSelection }) {
  const { user } = useAdminAuth();
  const [attributionDimension, setAttributionDimension] = useState<AttributionDimension["dimension"]>("marketingCampaign");
  const { data, loading, error, forbidden, reload } = useAdminData(
    () => getRevenueAnalytics(range),
    [range.preset, range.from, range.to],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <StatCardsSkeleton count={8} />
        <TableSkeleton rows={5} columns={6} />
      </div>
    );
  }
  if (forbidden) return <ForbiddenState role={user?.role} />;
  if (error || !data) return <ErrorState message={error ?? "Could not load revenue analytics."} onRetry={reload} />;

  const selectedDimension = data.attribution.dimensions.find((d) => d.dimension === attributionDimension);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
          <IndianRupee size={14} /> Revenue Analytics
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Collected Revenue"
            value={formatCurrencyInr(data.revenue.collectedRevenueInr)}
            tone="success"
            trend={data.revenueGrowth.growthPct ?? undefined}
          />
          <StatCard label="Net Revenue" value={formatCurrencyInr(data.revenue.netRevenueInr)} tone="success" />
          <StatCard label="Refunded" value={formatCurrencyInr(data.revenue.refundedInr)} tone="warning" />
          <StatCard label="Pipeline Value" value={formatCurrencyInr(data.revenue.pipelineValueInr)} tone="info" />
          <StatCard label="Won Revenue" value={formatCurrencyInr(data.revenue.wonRevenueInr)} tone="success" />
          <StatCard label="Lost Revenue" value={formatCurrencyInr(data.revenue.lostRevenueInr)} tone="danger" />
          <StatCard label="Avg. Deal Value" value={formatCurrencyInr(data.revenue.avgDealValueInr)} tone="accent" />
          <StatCard label="Revenue / Lead" value={formatCurrencyInr(data.revenue.revenuePerLeadInr)} tone="accent" />
          <StatCard label="Revenue / Conversion" value={formatCurrencyInr(data.revenue.revenuePerConversionInr)} tone="accent" />
          <StatCard label="Payment Success Rate" value={formatPct100(data.revenue.paymentSuccessRatePct)} tone="success" />
          <StatCard label="Payment Failure Rate" value={formatPct100(data.revenue.paymentFailureRatePct)} tone="danger" />
        </div>
        {Object.keys(data.revenue.collectedByOtherCurrency).length > 0 && (
          <p className="mt-3 text-xs" style={{ color: "var(--adm-text-muted)" }}>
            Also collected:{" "}
            {Object.entries(data.revenue.collectedByOtherCurrency)
              .map(([currency, amount]) => `${amount.toLocaleString("en-IN")} ${currency}`)
              .join(", ")}{" "}
            — excluded from the INR figures above.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
          Revenue Funnel
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FunnelViz
            title="Lead → Enrolled"
            stages={data.funnel.stages.map((s) => ({ label: s.label, value: s.count }))}
            note="Independent per-stage counts within the selected range, not a tracked per-lead cohort — see the Implementation Audit for why."
          />
          <div className="adm-card p-5">
            <p className="mb-3 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
              Stage Detail
            </p>
            <Table
              columns={[
                { key: "stage", header: "Stage", render: (s: (typeof data.funnel.stages)[number]) => s.label },
                { key: "count", header: "Count", align: "right", render: (s) => formatNumber(s.count) },
                { key: "conv", header: "Conv. from First", align: "right", render: (s) => formatPct100(s.conversionFromFirstPct) },
                { key: "drop", header: "Drop-off", align: "right", render: (s) => formatPct100(s.dropOffFromPreviousPct) },
                { key: "revenue", header: "Revenue", align: "right", render: (s) => (s.revenueInr === null ? "—" : formatCurrencyInr(s.revenueInr)) },
                { key: "time", header: "Avg. Time in Stage", align: "right", render: (s) => formatHoursShort(s.avgTimeInStageHours) },
              ]}
              rows={data.funnel.stages}
              getRowKey={(s) => s.key}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="!text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
            Revenue Attribution
          </h2>
          <div className="flex items-center gap-2">
            <select
              aria-label="Attribution dimension"
              className="adm-input adm-focus-ring !w-auto text-xs"
              value={attributionDimension}
              onChange={(e) => setAttributionDimension(e.target.value as AttributionDimension["dimension"])}
            >
              {data.attribution.dimensions.map((d) => (
                <option key={d.dimension} value={d.dimension}>
                  {ATTRIBUTION_DIMENSION_LABELS[d.dimension]} ({d.type === "direct" ? "Direct" : "Influenced"})
                </option>
              ))}
            </select>
            <ExportCsvButton section="attribution" range={range} />
          </div>
        </div>
        {selectedDimension && selectedDimension.rows.length === 0 ? (
          <EmptyState message="No attributable revenue on this dimension for the selected range yet." />
        ) : selectedDimension ? (
          <>
            <Table
              columns={[
                { key: "label", header: ATTRIBUTION_DIMENSION_LABELS[selectedDimension.dimension], render: (r) => r.label },
                { key: "revenue", header: "Revenue", align: "right", render: (r) => formatCurrencyInr(r.revenueInr) },
                { key: "count", header: "Payments", align: "right", render: (r) => formatNumber(r.paymentCount) },
              ]}
              rows={selectedDimension.rows}
              getRowKey={(r) => r.key}
            />
            {selectedDimension.unattributedInr > 0 && (
              <p className="mt-2 text-xs" style={{ color: "var(--adm-text-muted)" }}>
                {formatCurrencyInr(selectedDimension.unattributedInr)} in succeeded-payment revenue could not be attributed on this
                dimension ({selectedDimension.type === "direct" ? "no matching id on the payment" : "no linked lead to join through"}).
              </p>
            )}
          </>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="!text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
            Counsellor + Revenue
          </h2>
          <ExportCsvButton section="counsellors" range={range} />
        </div>
        {data.counsellors.counsellors.length === 0 ? (
          <EmptyState message="No active staff accounts yet." />
        ) : (
          <Table columns={COUNSELLOR_REVENUE_COLUMNS} rows={data.counsellors.counsellors} getRowKey={(c) => c.counsellorId} />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="!text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
            Campaign ROI
          </h2>
          <ExportCsvButton section="campaigns" range={range} />
        </div>
        {data.campaignRoi.campaigns.length === 0 ? (
          <EmptyState message="No campaigns yet." />
        ) : (
          <Table columns={CAMPAIGN_ROI_COLUMNS} rows={data.campaignRoi.campaigns} getRowKey={(c) => c.campaignId} />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="!text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
            WhatsApp Performance + Revenue
          </h2>
          <ExportCsvButton section="whatsapp" range={range} />
        </div>
        {data.whatsapp.campaigns.length === 0 ? (
          <EmptyState message="No WhatsApp campaigns yet." />
        ) : (
          <Table columns={WHATSAPP_REVENUE_COLUMNS} rows={data.whatsapp.campaigns} getRowKey={(c) => c.campaignId} />
        )}
      </section>
    </div>
  );
}

/** Enterprise Analytics (Phase 7), module 7.2 — top-level container:
 *  its own date range (defaults to Last 30 Days), independent of the
 *  Marketing Dashboard's own from/to fields above it on this same page
 *  (that section's date-only range convention has a real day-boundary
 *  gap this module deliberately doesn't repeat — see dateRanges.ts's
 *  own doc comment — so the two intentionally do not share state). */
function AutomationRevenueAnalyticsSection() {
  const [range, setRange] = useState<DateRangeSelection>({ preset: "last30" });

  return (
    <div className="space-y-6 border-t pt-6" style={{ borderColor: "var(--adm-line)" }}>
      <div className="adm-animate-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
            Automation &amp; Revenue Analytics
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            What&apos;s generating revenue — from workflow executions through to collected payments.
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>
      <AutomationAnalyticsSection range={range} />
      <RevenueAnalyticsSection range={range} />
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { user } = useAdminAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, loading, error, forbidden, reload } = useAdminData<AdminMarketingResponse>(
    () => getMarketing({ from: from || undefined, to: to || undefined }),
    [from, to],
  );

  return (
    <div className="space-y-6">
      <div className="adm-animate-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="!text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
            Analytics
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            Lead, conversion, and revenue funnels alongside ad performance. Defaults to the trailing 30 days.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <FormField id="mkt-from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <FormField id="mkt-to" label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <CounsellorLeaderboardSection />
      <PipelineAnalyticsSection />

      {loading && (
        <div className="space-y-6">
          <StatCardsSkeleton count={4} />
          <TableSkeleton rows={5} columns={8} />
        </div>
      )}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load analytics data."} onRetry={reload} />
      )}

      {!loading && !forbidden && !error && data && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <FunnelViz
              title="Lead Funnel"
              stages={[
                { label: "Visitors", value: data.leadFunnel.visitors },
                { label: "Leads", value: data.leadFunnel.leads },
              ]}
              note={
                data.leadFunnel.visitors === null
                  ? "No web analytics provider is connected yet — visitor count is unavailable, not zero."
                  : undefined
              }
            />
            <FunnelViz
              title="Conversion Funnel"
              stages={[
                { label: "Leads", value: data.conversionFunnel.leads },
                { label: "Registrations", value: data.conversionFunnel.registrations },
              ]}
              note={`${formatPercent(data.conversionFunnel.leadToRegistrationRate)} lead → registration rate`}
            />
            <FunnelViz
              title="Revenue Funnel"
              stages={[
                { label: "Registrations", value: data.revenueFunnel.registrations },
                { label: "Paid Students", value: data.revenueFunnel.paidStudents },
              ]}
              note={
                data.revenueFunnel.totalRevenueInr === null
                  ? "No revenue data source is configured yet (no Payments module) — figures are unavailable, not zero."
                  : `${formatCurrencyInr(data.revenueFunnel.totalRevenueInr)} total revenue`
              }
            />
          </div>

          <section>
            <h2 className="mb-3 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
              Account-Wide Ad Performance
            </h2>
            {!data.overall.adDataAvailable && (
              <p className="mb-3 text-xs" style={{ color: "var(--adm-text-muted)" }}>
                No ad platform is connected yet — these figures are unavailable, not zero.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="CTR" value={formatPercent(data.overall.ctr)} tone="accent" />
              <StatCard label="CPC" value={formatCurrencyInr(data.overall.cpc)} tone="info" />
              <StatCard label="CPA" value={formatCurrencyInr(data.overall.cpa)} tone="warning" />
              <StatCard
                label="ROAS"
                value={data.overall.roas === null ? null : `${data.overall.roas.toFixed(2)}x`}
                tone="success"
              />
            </div>
          </section>

          <WhatsAppPerformanceSection />

          <section>
            <h2 className="mb-3 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
              Campaign Breakdown
            </h2>
            {data.campaigns.length === 0 ? (
              <EmptyState message="No campaigns yet." />
            ) : (
              <Table columns={CAMPAIGN_COLUMNS} rows={data.campaigns} getRowKey={(c) => c.campaignId} />
            )}
          </section>
        </>
      )}

      <AutomationRevenueAnalyticsSection />
    </div>
  );
}
