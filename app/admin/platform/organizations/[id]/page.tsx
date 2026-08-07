"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useAdminData } from "@/components/admin/useAdminData";
import {
  getPlatformOrganization,
  suspendPlatformOrganization,
  reactivatePlatformOrganization,
  extendPlatformOrganizationTrial,
} from "@/components/admin/apiClient";
import { LoadingState, ErrorState, ForbiddenState } from "@/components/admin/DataStates";
import { Badge } from "@/components/admin/Badge";

/**
 * RC-6 — real, cross-service organization detail: organization record,
 * subscription, plan, active user count, resolved entitlements.
 * Dangerous actions (suspend, extend trial) require explicit
 * confirmation — suspend additionally requires a real, non-empty
 * reason (the mission's own "dangerous action UX" instruction) — never
 * one-click. Reactivation is the reverse of suspend and needs no
 * reason (undoing a restriction is lower-risk than imposing one).
 */
export default function PlatformOrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, loading, error, forbidden, reload } = useAdminData(() => getPlatformOrganization(id), [id]);

  const [confirmingSuspend, setConfirmingSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [confirmingExtend, setConfirmingExtend] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  if (loading) return <LoadingState label="Loading organization…" />;
  if (forbidden) return <ForbiddenState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { organization, subscription, plan, userCount, entitlements } = data;

  async function handleSuspend() {
    if (!suspendReason.trim()) {
      setActionError("A reason is required to suspend an organization.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    const result = await suspendPlatformOrganization(id, suspendReason);
    setActionPending(false);
    if (!result.success) {
      setActionError(result.errors[0]?.message ?? "Failed to suspend organization.");
      return;
    }
    setConfirmingSuspend(false);
    setSuspendReason("");
    reload();
  }

  async function handleReactivate() {
    setActionPending(true);
    setActionError(null);
    const result = await reactivatePlatformOrganization(id);
    setActionPending(false);
    if (!result.success) {
      setActionError(result.errors[0]?.message ?? "Failed to reactivate organization.");
      return;
    }
    reload();
  }

  async function handleExtendTrial() {
    setActionPending(true);
    setActionError(null);
    const result = await extendPlatformOrganizationTrial(id, trialDays);
    setActionPending(false);
    if (!result.success) {
      setActionError(result.errors[0]?.message ?? "Failed to extend trial.");
      return;
    }
    setConfirmingExtend(false);
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>
            {organization.name}
          </h1>
          <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
            {organization.slug} · {organization.id}
          </p>
        </div>
        <Badge tone={organization.status === "suspended" ? "danger" : "success"}>{organization.status}</Badge>
      </div>

      {organization.status === "suspended" && organization.suspendedReason && (
        <div className="adm-card flex items-start gap-3 p-4" style={{ borderColor: "var(--adm-danger)" }}>
          <AlertTriangle size={18} style={{ color: "var(--adm-danger)" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>
              Suspended {organization.suspendedAt && new Date(organization.suspendedAt).toLocaleString("en-IN")}
            </p>
            <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
              Reason: {organization.suspendedReason}
            </p>
          </div>
        </div>
      )}

      {actionError && <ErrorState message={actionError} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="adm-card p-5">
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Subscription
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt style={{ color: "var(--adm-text-muted)" }}>Plan</dt>
              <dd style={{ color: "var(--adm-text)" }}>{plan?.name ?? subscription.planId}</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--adm-text-muted)" }}>Status</dt>
              <dd>
                <Badge tone={subscription.status === "active" ? "success" : subscription.status === "trialing" ? "info" : "warning"}>
                  {subscription.status}
                </Badge>
              </dd>
            </div>
            {subscription.trialEndsAt && (
              <div className="flex justify-between">
                <dt style={{ color: "var(--adm-text-muted)" }}>Trial ends</dt>
                <dd style={{ color: "var(--adm-text)" }}>{new Date(subscription.trialEndsAt).toLocaleDateString("en-IN")}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt style={{ color: "var(--adm-text-muted)" }}>Current period ends</dt>
              <dd style={{ color: "var(--adm-text)" }}>{new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN")}</dd>
            </div>
          </dl>
        </div>

        <div className="adm-card p-5">
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Usage
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt style={{ color: "var(--adm-text-muted)" }}>Active users</dt>
              <dd style={{ color: "var(--adm-text)" }}>{userCount}</dd>
            </div>
            {entitlements && (
              <div className="flex justify-between">
                <dt style={{ color: "var(--adm-text-muted)" }}>Capabilities</dt>
                <dd className="max-w-[60%] text-right" style={{ color: "var(--adm-text)" }}>
                  {entitlements.capabilities.length} enabled
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="adm-card space-y-4 p-5">
        <h2 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
          Actions
        </h2>

        <div className="flex flex-wrap gap-3">
          {organization.status === "active" ? (
            <button
              type="button"
              onClick={() => setConfirmingSuspend((v) => !v)}
              className="adm-focus-ring adm-btn adm-btn-secondary"
              style={{ color: "var(--adm-danger)" }}
            >
              <AlertTriangle size={14} /> Suspend organization
            </button>
          ) : (
            <button type="button" onClick={handleReactivate} disabled={actionPending} className="adm-focus-ring adm-btn adm-btn-primary">
              <CheckCircle2 size={14} /> Reactivate organization
            </button>
          )}

          {subscription.status === "trialing" && (
            <button type="button" onClick={() => setConfirmingExtend((v) => !v)} className="adm-focus-ring adm-btn adm-btn-secondary">
              <Clock size={14} /> Extend trial
            </button>
          )}
        </div>

        {confirmingSuspend && (
          <div className="space-y-2 rounded-[var(--adm-radius-md)] p-3" style={{ background: "var(--adm-surface-2)" }}>
            <label className="text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
              Reason (required — this organization&apos;s writes/campaigns/automation/provider sends will stop; historical data, billing, and audit logs remain intact)
            </label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={2}
              className="adm-focus-ring w-full rounded-[var(--adm-radius-md)] p-2 text-sm"
              style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-border)", color: "var(--adm-text)" }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSuspend}
                disabled={actionPending || !suspendReason.trim()}
                className="adm-focus-ring adm-btn adm-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "var(--adm-danger)" }}
              >
                Confirm suspend
              </button>
              <button type="button" onClick={() => setConfirmingSuspend(false)} className="adm-focus-ring adm-btn adm-btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        )}

        {confirmingExtend && (
          <div className="space-y-2 rounded-[var(--adm-radius-md)] p-3" style={{ background: "var(--adm-surface-2)" }}>
            <label className="text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
              Extend trial by how many days?
            </label>
            <input
              type="number"
              min={1}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="adm-focus-ring w-24 rounded-[var(--adm-radius-md)] p-2 text-sm"
              style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-border)", color: "var(--adm-text)" }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExtendTrial}
                disabled={actionPending || trialDays <= 0}
                className="adm-focus-ring adm-btn adm-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm extend trial
              </button>
              <button type="button" onClick={() => setConfirmingExtend(false)} className="adm-focus-ring adm-btn adm-btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
