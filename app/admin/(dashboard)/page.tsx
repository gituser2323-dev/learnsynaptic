"use client";

import { useMemo } from "react";
import { Users, CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { getAnalytics, type AdminAnalyticsResponse } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { StatCard } from "@/components/admin/StatCard";
import { Table, type TableColumn } from "@/components/admin/Table";
import { ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { StatCardsSkeleton, TableSkeleton } from "@/components/admin/Skeleton";
import { DonutStat } from "@/components/admin/charts/DonutStat";
import { BarComparison } from "@/components/admin/charts/BarComparison";
import { ProgressRing } from "@/components/admin/charts/ProgressRing";
import type { UtmBreakdownRow } from "@/lib/services/leads";

const PROGRAM_COLUMNS: TableColumn<{ programSlug: string; count: number }>[] = [
  { key: "program", header: "Program", render: (row) => row.programSlug },
  { key: "count", header: "Registrations", align: "right", render: (row) => row.count },
];

const UTM_COLUMNS: TableColumn<UtmBreakdownRow>[] = [
  { key: "source", header: "Source", render: (row) => row.utmSource ?? "—" },
  { key: "medium", header: "Medium", render: (row) => row.utmMedium ?? "—" },
  { key: "campaign", header: "Campaign", render: (row) => row.utmCampaign ?? "—" },
  { key: "leads", header: "Leads", align: "right", render: (row) => row.leadCount },
];

export default function AdminOverviewPage() {
  const { user } = useAdminAuth();
  const { data, loading, error, forbidden, reload } = useAdminData<AdminAnalyticsResponse>(getAnalytics, []);

  const utmBySource = useMemo(() => {
    if (!data) return [];
    const totals = new Map<string, number>();
    for (const row of data.utm) {
      const key = row.utmSource ?? "Direct / unknown";
      totals.set(key, (totals.get(key) ?? 0) + row.leadCount);
    }
    return Array.from(totals, ([label, value]) => ({ label, value }));
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <StatCardsSkeleton count={4} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TableSkeleton rows={4} columns={2} />
          <TableSkeleton rows={4} columns={2} />
          <TableSkeleton rows={4} columns={2} />
        </div>
        <TableSkeleton rows={4} columns={4} />
      </div>
    );
  }
  if (forbidden) return <ForbiddenState role={user?.role} />;
  if (error || !data) return <ErrorState message={error ?? "Could not load overview."} onRetry={reload} />;

  const { registrations, utm, studentStatus } = data;

  return (
    <div className="space-y-6">
      <div className="adm-animate-in">
        <h1 className="!text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
          Registration, attendance, and lead-source performance across the whole funnel.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Registrations" value={registrations.totalRegistrations} icon={ClipboardList} tone="accent" />
        <StatCard
          label="Overall Attendance Rate"
          value={studentStatus.overallAttendanceRate === null ? null : `${Math.round(studentStatus.overallAttendanceRate * 100)}%`}
          sublabel={studentStatus.overallAttendanceRate === null ? "No attendance recorded yet" : undefined}
          icon={Users}
          tone="info"
        />
        <StatCard label="Confirmed Registrations" value={registrations.byStatus.confirmed ?? 0} icon={CheckCircle2} tone="success" />
        <StatCard label="Cancelled Registrations" value={registrations.byStatus.cancelled ?? 0} icon={XCircle} tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DonutStat
          title="Registrations by Status"
          slices={[
            { label: "Pending", value: registrations.byStatus.pending ?? 0, color: "warning" },
            { label: "Confirmed", value: registrations.byStatus.confirmed ?? 0, color: "success" },
            { label: "Cancelled", value: registrations.byStatus.cancelled ?? 0, color: "danger" },
          ]}
        />
        <BarComparison
          title="Registrations by Program"
          data={registrations.byProgram.map((row) => ({ label: row.programSlug, value: row.count }))}
          valueLabel="registrations"
        />
        <ProgressRing
          label="Attendance Rate"
          value={studentStatus.overallAttendanceRate}
          sublabel={
            studentStatus.overallAttendanceRate === null
              ? "No sessions marked yet"
              : `Across ${studentStatus.totalRegistrations} registration${studentStatus.totalRegistrations === 1 ? "" : "s"}`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarComparison title="Leads by UTM Source" data={utmBySource} valueLabel="leads" />

        <section className="adm-card adm-animate-in p-5">
          <p className="mb-3 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Registrations by Program
          </p>
          {registrations.byProgram.length === 0 ? (
            <EmptyState message="No registrations yet." />
          ) : (
            <Table columns={PROGRAM_COLUMNS} rows={registrations.byProgram} getRowKey={(row) => row.programSlug} />
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-3 !text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
          UTM Breakdown
        </h2>
        {utm.length === 0 ? (
          <EmptyState message="No UTM-tagged leads yet." />
        ) : (
          <Table
            columns={UTM_COLUMNS}
            rows={utm}
            getRowKey={(row) => `${row.utmSource}-${row.utmMedium}-${row.utmCampaign}`}
          />
        )}
      </section>
    </div>
  );
}
