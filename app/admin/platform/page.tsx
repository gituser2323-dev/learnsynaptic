"use client";

import { Building2, Users, TrendingUp, AlertTriangle, Activity, Shield, Plug } from "lucide-react";
import { useAdminData } from "@/components/admin/useAdminData";
import { getPlatformDashboard } from "@/components/admin/apiClient";
import { StatCard } from "@/components/admin/StatCard";
import { LoadingState, ErrorState, ForbiddenState } from "@/components/admin/DataStates";
import { Badge } from "@/components/admin/Badge";

const CATEGORY_TONE = { ok: "success", warning: "warning", critical: "danger" } as const;

/**
 * RC-6 — the owner-level SaaS dashboard. Every number here comes
 * straight from `platformDashboardService`'s own real data sources —
 * see that module's doc comment for exactly how each field is derived
 * and which ones are explicitly labelled as estimates (MRR) rather
 * than audited figures.
 */
export default function PlatformDashboardPage() {
  const { data, loading, error, forbidden, reload } = useAdminData(() => getPlatformDashboard(), []);

  if (loading) return <LoadingState label="Loading platform dashboard…" />;
  if (forbidden) return <ForbiddenState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { snapshot } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>
          Platform Dashboard
        </h1>
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          Generated {new Date(snapshot.generatedAt).toLocaleString("en-IN")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Organizations" value={snapshot.organizations.total} icon={Building2} />
        <StatCard label="Active Organizations" value={snapshot.organizations.active} icon={Building2} tone="success" />
        <StatCard label="Suspended Organizations" value={snapshot.organizations.suspended} icon={AlertTriangle} tone="danger" />
        <StatCard label="Total Platform Users" value={snapshot.totalPlatformUsers} icon={Users} />
        <StatCard label="Trialing Subscriptions" value={snapshot.subscriptions.trialing} icon={TrendingUp} tone="info" />
        <StatCard label="Active Subscriptions" value={snapshot.subscriptions.active} icon={TrendingUp} tone="success" />
        <StatCard label="Past Due Subscriptions" value={snapshot.subscriptions.pastDue} icon={AlertTriangle} tone="warning" />
        <StatCard label="Failed Payments (24h)" value={snapshot.failedPaymentsLast24h} icon={AlertTriangle} tone={snapshot.failedPaymentsLast24h > 0 ? "danger" : "accent"} />
        <StatCard label="Critical Integration Failures" value={snapshot.criticalIntegrationFailures} icon={AlertTriangle} tone={snapshot.criticalIntegrationFailures > 0 ? "danger" : "accent"} />
        <StatCard label="Queue — Pending" value={snapshot.queueHealth.countsByStatus.pending} icon={Activity} />
        <StatCard label="Queue — Dead-lettered" value={snapshot.queueHealth.countsByStatus.dead_lettered} icon={AlertTriangle} tone={snapshot.queueHealth.countsByStatus.dead_lettered > 0 ? "danger" : "accent"} />
      </div>

      {snapshot.estimatedMrr.length > 0 && (
        <div className="adm-card p-5">
          <h2 className="mb-1 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Estimated MRR
          </h2>
          <p className="mb-3 text-xs" style={{ color: "var(--adm-text-muted)" }}>
            Derived from each active/trialing subscription&apos;s assigned plan price — an
            estimate, not audited revenue (a real charge can differ from list price).
          </p>
          <div className="flex flex-wrap gap-4">
            {snapshot.estimatedMrr.map((m) => (
              <div key={m.currency}>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--adm-text)" }}>
                  {(m.mrrInSmallestUnit / 100).toLocaleString("en-IN", { style: "currency", currency: m.currency })}
                </p>
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {m.currency} · from {m.subscriptionCount} subscription{m.subscriptionCount === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="adm-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
          <Shield size={15} /> Platform Health
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {snapshot.platformHealth.categories.map((c) => (
            <div key={c.category} className="flex items-center justify-between gap-2 text-sm">
              <span style={{ color: "var(--adm-text-secondary)" }}>{c.category}</span>
              <Badge tone={CATEGORY_TONE[c.status]}>{c.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="adm-card p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
          <Plug size={15} /> Configuration & Integration Verification
        </h2>
        <p className="mb-3 text-xs" style={{ color: "var(--adm-text-muted)" }}>
          Deployment-wide default credentials — real env-var presence, not a live vendor call (use each provider&apos;s
          own &quot;Test Connection&quot; in Settings → Integrations for that). An organization can still override any
          of these with its own tenant credential regardless of what&apos;s shown here.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {snapshot.platformHealth.tenantIntegrations.map((t) => (
            <div key={t.integration} className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0" style={{ borderColor: "var(--adm-border)" }}>
              <div>
                <p style={{ color: "var(--adm-text-secondary)" }}>{t.integration}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {t.detail}
                </p>
              </div>
              <Badge tone={t.configured ? "success" : "neutral"}>{t.configured ? "configured" : "not configured"}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="adm-card p-5">
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
          Recent Security Events
        </h2>
        {snapshot.recentSecurityEvents.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
            No recent security events.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {snapshot.recentSecurityEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3" style={{ color: "var(--adm-text-secondary)" }}>
                <span>{e.action}</span>
                <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {new Date(e.createdAt).toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
