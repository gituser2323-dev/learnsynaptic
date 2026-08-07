"use client";

import { useState } from "react";
import {
  Gauge,
  AlertTriangle,
  IndianRupee,
  Kanban,
  Trophy,
  Megaphone,
  MessageCircle,
  Zap,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { getActionCenter, getExecutiveDashboard, type RevenueAnalyticsQuery } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { StatCard } from "@/components/admin/StatCard";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Badge } from "@/components/admin/Badge";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { StatCardsSkeleton, TableSkeleton } from "@/components/admin/Skeleton";
import { FunnelViz } from "@/components/admin/charts/FunnelViz";
import { TrendLine } from "@/components/admin/charts/TrendLine";
import { DateRangePicker, type DateRangeSelection } from "@/components/admin/DateRangePicker";
import { formatCurrencyInr, formatNumber } from "@/components/admin/format";
import type { CounsellorRevenueStats } from "@/lib/services/revenueAnalytics";
import type { CampaignRoiEntry } from "@/lib/services/revenueAnalytics";
import type { WorkflowPerformanceEntry } from "@/lib/services/automation/analytics";
import type { ActionCenterCategoryResult } from "@/lib/services/executiveDashboard";

function formatPct100(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

/** Mission's own §"ACTION CENTER" — real, already-computed operational
 *  signals (see actionCenterService.ts), rendered as clickable cards so
 *  an admin can navigate directly to the relevant record/module. Empty
 *  categories are hidden rather than shown as a hollow "0" card — a
 *  business owner scanning this section wants only what's actually
 *  wrong. */
function ActionCenterSection({ range }: { range: DateRangeSelection }) {
  const { user } = useAdminAuth();
  const { data, loading, error, forbidden, reload } = useAdminData(
    () => getActionCenter(range),
    [range.preset, range.from, range.to],
  );

  if (loading) return <StatCardsSkeleton count={4} />;
  if (forbidden) return <ForbiddenState role={user?.role} />;
  if (error || !data) return <ErrorState message={error ?? "Could not load the Action Center."} onRetry={reload} />;

  const nonEmpty = data.categories.filter((c: ActionCenterCategoryResult) => c.count > 0);

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
        <AlertTriangle size={14} /> Needs Attention
        {data.totalCount > 0 && <Badge tone="danger">{data.totalCount}</Badge>}
      </h2>
      {nonEmpty.length === 0 ? (
        <EmptyState message="Nothing needs attention right now." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {nonEmpty.map((category: ActionCenterCategoryResult) => (
            <Link
              key={category.category}
              href={category.href}
              className="adm-card adm-card-hover adm-focus-ring block p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                  {category.label}
                </p>
                <ChevronRight size={14} style={{ color: "var(--adm-text-muted)" }} />
              </div>
              <p className="mt-1 !text-2xl font-bold" style={{ color: "var(--adm-danger)" }}>
                {formatNumber(category.count)}
              </p>
              {category.items.length > 0 && (
                <p className="mt-1 truncate text-xs" style={{ color: "var(--adm-text-secondary)" }} title={category.items[0].label}>
                  {category.items[0].label} — {category.items[0].detail}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

const COUNSELLOR_COLUMNS: TableColumn<CounsellorRevenueStats>[] = [
  { key: "name", header: "Counsellor", render: (c) => c.name },
  { key: "leads", header: "Leads", align: "right", render: (c) => formatNumber(c.leadsAssignedCount) },
  { key: "conversionRate", header: "Conv. Rate", align: "right", render: (c) => formatPct100(c.conversionRatePct) },
  { key: "won", header: "Won", align: "right", render: (c) => formatNumber(c.wonOpportunitiesCount) },
  { key: "overdue", header: "Overdue", align: "right", render: (c) => (c.overdueTasksCount > 0 ? <Badge tone="danger">{c.overdueTasksCount}</Badge> : formatNumber(0)) },
  { key: "revenue", header: "Revenue", align: "right", render: (c) => formatCurrencyInr(c.revenueInr) },
];

const CAMPAIGN_COLUMNS: TableColumn<CampaignRoiEntry>[] = [
  { key: "name", header: "Campaign", render: (c) => c.campaignName },
  { key: "leads", header: "Leads", align: "right", render: (c) => (c.leadMatchAvailable ? formatNumber(c.leads) : "—") },
  { key: "conversions", header: "Conversions", align: "right", render: (c) => formatNumber(c.conversions) },
  { key: "revenue", header: "Revenue", align: "right", render: (c) => formatCurrencyInr(c.revenueInr) },
  {
    key: "roi",
    header: "ROI",
    align: "right",
    render: (c) => (c.roiPct === null ? "—" : <Badge tone={c.roiPct >= 0 ? "success" : "danger"}>{c.roiPct.toFixed(0)}%</Badge>),
  },
];

const WORKFLOW_COLUMNS: TableColumn<WorkflowPerformanceEntry>[] = [
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
  { key: "errorRate", header: "Error Rate", align: "right", render: (w) => formatPct100(w.errorRatePct) },
  { key: "revenue", header: "Revenue Influenced", align: "right", render: (w) => formatCurrencyInr(w.revenueInfluencedInr) },
];

function SectionHeader({ icon: Icon, title, href, linkLabel }: { icon: typeof Gauge; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-1.5 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
        <Icon size={14} /> {title}
      </h2>
      {href && (
        <Link href={href} className="adm-focus-ring flex items-center gap-1 text-xs font-medium" style={{ color: "var(--adm-accent)" }}>
          {linkLabel ?? "View full analytics"} <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

/** Enterprise Analytics (Phase 7), module 7.3 — Executive Dashboard: the
 *  flagship owner-level command center. Mission's own explicit "should
 *  primarily COMPOSE existing analytics rather than create a competing
 *  analytics system" — every section below either renders a Module 7.1/
 *  7.2 result verbatim or, for Counsellor Performance/Campaign
 *  Performance (both already fully tabulated on /admin/analytics), a
 *  condensed top-N view with a drill-through link, per the mission's own
 *  "do NOT duplicate — provide drill-through/navigation" instruction. */
export default function ExecutiveDashboardPage() {
  const { user } = useAdminAuth();
  const [range, setRange] = useState<DateRangeSelection>({ preset: "last30" });
  const query: RevenueAnalyticsQuery = { preset: range.preset, from: range.from, to: range.to };

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => getExecutiveDashboard(query),
    [range.preset, range.from, range.to],
  );

  const topCounsellors = data ? [...data.counsellors.counsellors].sort((a, b) => b.revenueInr - a.revenueInr).slice(0, 5) : [];
  const topCampaigns = data ? [...data.campaignRoi.campaigns].sort((a, b) => b.revenueInr - a.revenueInr).slice(0, 5) : [];
  const workflowsNeedingAttention = data
    ? [...data.workflowPerformance.workflows].filter((w) => w.failures > 0).sort((a, b) => b.failures - a.failures).slice(0, 5)
    : [];
  const bestWorkflow = data
    ? [...data.workflowPerformance.workflows].filter((w) => w.runs > 0).sort((a, b) => b.revenueInfluencedInr - a.revenueInfluencedInr)[0]
    : undefined;

  return (
    <div className="space-y-8">
      <div className="adm-animate-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 !text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
            <Gauge size={22} /> Executive Dashboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
            What&apos;s happening in your business right now, why it&apos;s happening, and what needs your attention.
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <ActionCenterSection range={range} />

      {loading && (
        <div className="space-y-8">
          <StatCardsSkeleton count={8} />
          <TableSkeleton rows={5} columns={5} />
        </div>
      )}
      {!loading && forbidden && <ForbiddenState role={user?.role} />}
      {!loading && !forbidden && (error || !data) && (
        <ErrorState message={error ?? "Could not load the Executive Dashboard."} onRetry={reload} />
      )}

      {!loading && !forbidden && !error && data && (
        <>
          <section>
            <SectionHeader icon={Gauge} title="Executive KPIs" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Total Leads" value={formatNumber(data.kpis.totalLeadsInRange)} tone="accent" />
              <StatCard
                label="Qualified Leads"
                value={formatNumber(data.kpis.qualifiedLeadsCount)}
                sublabel="Hot + warm, live"
                tone="accent"
              />
              <StatCard label="Conversions" value={formatNumber(data.kpis.conversionsInRange)} tone="success" />
              <StatCard label="Conversion Rate" value={formatPct100(data.kpis.conversionRatePct)} tone="success" />
              <StatCard
                label="Collected Revenue"
                value={formatCurrencyInr(data.kpis.collectedRevenueInr)}
                tone="success"
                trend={data.revenueGrowth.growthPct ?? undefined}
              />
              <StatCard label="Expected Revenue" value={formatCurrencyInr(data.kpis.expectedRevenueInr)} tone="info" />
              <StatCard label="Pipeline Value" value={formatCurrencyInr(data.kpis.pipelineValueInr)} tone="info" />
              <StatCard label="Avg. Deal Value" value={formatCurrencyInr(data.kpis.avgDealValueInr)} tone="accent" />
              <StatCard label="Payment Success Rate" value={formatPct100(data.kpis.paymentSuccessRatePct)} tone="success" />
              <StatCard label="Open Opportunities" value={formatNumber(data.kpis.openOpportunitiesCount)} tone="info" />
              <StatCard label="Won Opportunities" value={formatNumber(data.kpis.wonOpportunitiesCount)} sublabel="All-time" tone="success" />
              <StatCard label="Lost Opportunities" value={formatNumber(data.kpis.lostOpportunitiesCount)} sublabel="All-time" tone="danger" />
              <StatCard label="Active Automations" value={formatNumber(data.kpis.activeWorkflowDefinitions)} tone="accent" />
              <StatCard label="Automation Success Rate" value={formatPct100(data.kpis.automationSuccessRatePct)} tone="success" />
              <StatCard label="WhatsApp Delivery Rate" value={formatPct100(data.kpis.whatsappDeliveryRatePct)} tone="info" />
            </div>
          </section>

          <section>
            <SectionHeader icon={IndianRupee} title="Revenue Overview" href="/admin/analytics" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <TrendLine
                  title="Collected Revenue Trend"
                  data={data.revenueTrend}
                  series={[{ key: "collectedRevenueInr", label: "Collected", color: "success" }]}
                  note={
                    data.revenueTrend.length === 0
                      ? "Trend is omitted for ranges longer than 92 days — narrow the date range to see a day-by-day breakdown."
                      : undefined
                  }
                />
              </div>
              <div className="adm-card p-5">
                <p className="mb-3 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
                  Collected vs. Expected
                </p>
                <div className="space-y-3">
                  <StatCard label="Won Revenue" value={formatCurrencyInr(data.revenue.wonRevenueInr)} tone="success" />
                  <StatCard label="Lost Revenue" value={formatCurrencyInr(data.revenue.lostRevenueInr)} tone="danger" />
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader icon={Kanban} title="Sales Funnel" href="/admin/analytics" />
            <FunnelViz
              title="Lead → Enrolled"
              stages={data.funnel.stages.map((s) => ({ label: s.label, value: s.count }))}
              note="Each stage shows how many leads reached it within the selected date range, counted independently — not a single cohort tracked stage-by-stage."
            />
          </section>

          <section>
            <SectionHeader icon={Trophy} title="Counsellor Performance" href="/admin/analytics" linkLabel="View full leaderboard" />
            {topCounsellors.length === 0 ? (
              <EmptyState message="No active staff accounts yet." />
            ) : (
              <Table columns={COUNSELLOR_COLUMNS} rows={topCounsellors} getRowKey={(c) => c.counsellorId} />
            )}
          </section>

          <section>
            <SectionHeader icon={Megaphone} title="Campaign Performance" href="/admin/analytics" linkLabel="View full breakdown" />
            {topCampaigns.length === 0 ? (
              <EmptyState message="No campaigns yet." />
            ) : (
              <Table columns={CAMPAIGN_COLUMNS} rows={topCampaigns} getRowKey={(c) => c.campaignId} />
            )}
          </section>

          <section>
            <SectionHeader icon={MessageCircle} title="WhatsApp Health" href="/admin/whatsapp" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Sent" value={formatNumber(data.whatsapp.sentCount)} tone="accent" />
              <StatCard label="Delivered" value={formatNumber(data.whatsapp.deliveredCount)} tone="success" />
              <StatCard label="Read" value={formatNumber(data.whatsapp.readCount)} tone="success" />
              <StatCard label="Failed" value={formatNumber(data.whatsapp.failedCount)} tone="danger" />
              <StatCard label="Delivery Rate" value={formatPct100(data.whatsapp.deliveryRatePct)} tone="info" />
              <StatCard label="Read Rate" value={formatPct100(data.whatsapp.readRatePct)} tone="info" />
            </div>
          </section>

          <section>
            <SectionHeader icon={Zap} title="Automation Health" href="/admin/automation" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Active Workflows" value={formatNumber(data.automation.activeWorkflowDefinitions)} sublabel={`of ${data.automation.totalWorkflowDefinitions} total`} tone="accent" />
              <StatCard label="Runs" value={formatNumber(data.automation.executions)} tone="accent" />
              <StatCard label="Success Rate" value={formatPct100(data.automation.successRatePct)} tone="success" />
              <StatCard label="Dead-Letter Count" value={formatNumber(data.automation.deadLetterCount)} tone="danger" />
              <StatCard
                label="Best Performer"
                value={bestWorkflow ? formatCurrencyInr(bestWorkflow.revenueInfluencedInr) : null}
                sublabel={bestWorkflow?.workflowName}
                tone="success"
              />
            </div>
            {workflowsNeedingAttention.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold" style={{ color: "var(--adm-text-secondary)" }}>
                  Workflows Needing Attention
                </p>
                <Table columns={WORKFLOW_COLUMNS} rows={workflowsNeedingAttention} getRowKey={(w) => w.workflowId} />
              </div>
            )}
          </section>

          <section>
            <SectionHeader icon={CreditCard} title="Payment Health" href="/admin/payments" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Succeeded" value={formatNumber(data.payments.succeededCount)} tone="success" />
              <StatCard label="Failed" value={formatNumber(data.payments.failedCount)} tone="danger" />
              <StatCard label="Refunded" value={formatNumber(data.payments.refundedCount)} tone="warning" />
              <StatCard label="Success Rate" value={formatPct100(data.payments.paymentSuccessRatePct)} tone="success" />
              <StatCard label="All-Time Collected" value={formatCurrencyInr(data.payments.allTimeCollectedRevenueInr)} tone="success" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
