"use client";

import { useState } from "react";
import { useAdminData } from "@/components/admin/useAdminData";
import { getPlatformOnboardingFunnel, type OrganizationOnboardingSummary } from "@/components/admin/apiClient";
import { Table, type TableColumn } from "@/components/admin/Table";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingState, ErrorState, ForbiddenState, EmptyState } from "@/components/admin/DataStates";
import { Badge, type BadgeTone } from "@/components/admin/Badge";

/**
 * RC-7 — Customer Onboarding & SaaS Activation. Mission §32/§44: the
 * Platform Super Admin's own aggregate onboarding funnel and
 * per-organization onboarding status — every number here is a real
 * query (see platformOnboardingService's own doc comment), never
 * tenant-private CRM data.
 */

const STAGE_LABELS: Record<string, string> = {
  registered: "Registered",
  verified: "Verified",
  organizationCreated: "Organization Created",
  trialStarted: "Trial Started",
  integrationConnected: "Integration Connected",
  activated: "Activated",
};

const STATUS_TONE: Record<OrganizationOnboardingSummary["status"], BadgeTone> = {
  not_started: "neutral",
  in_progress: "warning",
  activated: "success",
};

export default function PlatformOnboardingPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, forbidden, reload } = useAdminData(() => getPlatformOnboardingFunnel(page, 20), [page]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>
        Onboarding
      </h1>

      {loading ? (
        <LoadingState label="Loading onboarding funnel…" />
      ) : forbidden ? (
        <ForbiddenState />
      ) : error || !data ? (
        <ErrorState message={error ?? "Could not load onboarding data."} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(Object.entries(data.funnel.stages) as [string, number][]).map(([stage, count]) => (
              <div key={stage} className="adm-card p-4">
                <p className="text-2xl font-bold" style={{ color: "var(--adm-text)" }}>
                  {count}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {STAGE_LABELS[stage] ?? stage}
                </p>
              </div>
            ))}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
              Organizations
            </h2>
            {data.organizations.items.length === 0 ? (
              <EmptyState message="No organizations yet." />
            ) : (
              <>
                <Table
                  columns={
                    [
                      { key: "name", header: "Organization", render: (o) => <span style={{ color: "var(--adm-text)" }}>{o.name}</span> },
                      {
                        key: "status",
                        header: "Status",
                        render: (o) => <Badge tone={STATUS_TONE[o.status]}>{o.status.replace("_", " ")}</Badge>,
                      },
                      {
                        key: "steps",
                        header: "Steps",
                        render: (o) => (
                          <span style={{ color: "var(--adm-text-muted)" }}>
                            {o.stepsCompleted} completed · {o.stepsSkipped} skipped
                          </span>
                        ),
                      },
                      {
                        key: "activatedAt",
                        header: "Activated",
                        render: (o) => <span style={{ color: "var(--adm-text-muted)" }}>{o.activatedAt ? new Date(o.activatedAt).toLocaleDateString("en-IN") : "—"}</span>,
                      },
                      {
                        key: "createdAt",
                        header: "Created",
                        render: (o) => <span style={{ color: "var(--adm-text-muted)" }}>{new Date(o.createdAt).toLocaleDateString("en-IN")}</span>,
                      },
                    ] as TableColumn<OrganizationOnboardingSummary>[]
                  }
                  rows={data.organizations.items}
                  getRowKey={(o) => o.organizationId}
                />
                <Pagination
                  page={page}
                  totalPages={Math.max(1, Math.ceil(data.organizations.total / 20))}
                  total={data.organizations.total}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
