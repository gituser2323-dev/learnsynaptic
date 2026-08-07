"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { SetupChecklist } from "@/components/onboarding/SetupChecklist";
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

/** RC-9 — a real, live-reproduced dead end in the self-service
 *  onboarding funnel: middleware.ts's own doc comment claims `/admin`
 *  "resolves onward to the onboarding wizard or the dashboard depending
 *  on real server-side state," but nothing on this page actually did
 *  that — a genuinely fresh, just-verified, self-registered user (no
 *  organization created yet) landed here after signing in and hit a
 *  flat "You don't have permission to view this" `ForbiddenState`
 *  instead of being routed to finish setup. Root cause:
 *  withApiRoute.ts's own pre-organization gate throws a specific,
 *  distinguishable `ForbiddenApiError("Complete your organization setup
 *  to continue.")` for exactly this case, but this page's `forbidden`
 *  boolean collapsed that together with an ordinary role-based 403 and
 *  showed the same dead-end state for both. */
const ORG_SETUP_INCOMPLETE_MESSAGE_FRAGMENT = "organization setup";

export default function AdminOverviewPage() {
  const { user } = useAdminAuth();
  const router = useRouter();
  const { data, loading, error, forbidden, forbiddenMessage, reload } = useAdminData<AdminAnalyticsResponse>(getAnalytics, []);

  const needsOrganizationSetup = forbidden && (forbiddenMessage?.toLowerCase().includes(ORG_SETUP_INCOMPLETE_MESSAGE_FRAGMENT) ?? false);

  useEffect(() => {
    if (needsOrganizationSetup) {
      router.replace("/admin/onboarding");
    }
  }, [needsOrganizationSetup, router]);

  const utmBySource = useMemo(() => {
    if (!data) return [];
    const totals = new Map<string, number>();
    for (const row of data.utm) {
      const key = row.utmSource ?? "Direct / unknown";
      totals.set(key, (totals.get(key) ?? 0) + row.leadCount);
    }
    return Array.from(totals, ([label, value]) => ({ label, value }));
  }, [data]);

  if (loading || needsOrganizationSetup) {
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

      <SetupChecklist />

      <Link
        href="/admin/executive"
        className="adm-focus-ring adm-card adm-card-hover adm-animate-in flex items-center justify-between gap-3 p-4 no-underline"
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Looking for revenue, pipeline, and team performance?
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-muted)" }}>
            The Executive Dashboard shows your whole business — revenue, leads, team, campaigns, WhatsApp, and automation health — in one place.
          </p>
        </div>
        <span className="adm-btn adm-btn-secondary h-9 shrink-0 text-xs">Open Executive Dashboard</span>
      </Link>

      {registrations.totalRegistrations === 0 && (
        <div className="adm-card adm-animate-in flex flex-wrap items-center justify-between gap-3 p-4" style={{ borderColor: "var(--adm-accent)" }}>
          <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
            No registrations yet — import an existing lead list or start capturing new ones to fill the funnel.
          </p>
          <Link href="/admin/leads" className="adm-focus-ring adm-btn adm-btn-primary h-9 text-xs">
            Import or add a lead
          </Link>
        </div>
      )}

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
