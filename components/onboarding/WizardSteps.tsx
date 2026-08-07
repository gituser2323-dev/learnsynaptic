"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowRight,
  SkipForward,
  Check,
  MessageCircle,
  Mail,
  Sparkles,
  CalendarDays,
  Workflow,
  Upload,
  Users,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import {
  listOnboardingPlans,
  assignPlan,
  listIntegrations,
  getWhatsAppEmbeddedSignupConfig,
  setIntegrationCredentials,
  listPipelines,
  previewLeadImport,
  commitLeadImport,
  sendTeamInvitation,
  listTeamInvitations,
  revokeTeamInvitation,
  type OnboardingSelectablePlan,
  type TeamInvitation,
} from "@/components/admin/apiClient";
import type { IntegrationSummary } from "@/lib/services/integrations";
import type { Pipeline } from "@/lib/services/crm/pipelines";
import type { UserRole } from "@/lib/services/auth";

/**
 * RC-7 — Customer Onboarding & SaaS Activation. Every step here calls
 * the SAME real, already-existing routes the rest of the admin app
 * uses (Module 8.3's assignPlan, the Integrations Hub's own
 * listIntegrations/setIntegrationCredentials, WhatsApp Embedded
 * Signup, Module 6.3's calendar sync, Module 1.4's lead importer) —
 * never a parallel onboarding-only implementation of any of them
 * (mission's own explicit "do not create a second X" instruction,
 * repeated per step). Each step is a thin, business-owner-friendly
 * wrapper around a real feature, not a new feature.
 */

function StepActions({
  onSkip,
  skipLabel = "Skip for now",
  children,
}: {
  onSkip: () => void;
  skipLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <button type="button" onClick={onSkip} className="adm-focus-ring adm-btn adm-btn-secondary h-10 text-sm">
        <SkipForward size={14} /> {skipLabel}
      </button>
      {children}
    </div>
  );
}

function StepHeading({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--adm-radius-lg)]"
        style={{ background: "color-mix(in srgb, var(--adm-accent) 16%, transparent)", color: "var(--adm-accent)" }}
      >
        <Icon size={20} />
      </span>
      <div>
        <h2 className="text-lg font-bold" style={{ color: "var(--adm-text)" }}>
          {title}
        </h2>
        <p className="mt-0.5 text-sm" style={{ color: "var(--adm-text-muted)" }}>
          {description}
        </p>
      </div>
    </div>
  );
}

// ─── Plan / Trial ───────────────────────────────────────────────────────

export function PlanStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [plans, setPlans] = useState<OnboardingSelectablePlan[] | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listOnboardingPlans().then((result) => {
      if (result.success) setPlans(result.data.plans);
    });
  }, []);

  async function handleSelect(planId: string) {
    setSelecting(planId);
    setError(null);
    const result = await assignPlan(planId);
    setSelecting(null);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Couldn't select that plan.");
      return;
    }
    onComplete();
  }

  return (
    <div>
      <StepHeading icon={CreditCard} title="Choose how you'd like to start" description="Pick a plan to unlock your workspace — no card required for a trial." />
      {!plans ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--adm-accent)" }} />
        </div>
      ) : plans.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          No plans are available to select right now — you can continue and choose one later from Settings.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <div key={plan.id} className="adm-card flex flex-col gap-3 p-4" style={{ borderColor: "var(--adm-accent)" }}>
              <div>
                <h3 className="font-semibold" style={{ color: "var(--adm-text)" }}>
                  {plan.name}
                </h3>
                <p className="mt-1 text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {plan.description}
                </p>
              </div>
              {plan.trialDays > 0 && (
                <span className="w-fit rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--adm-success-soft)", color: "var(--adm-success)" }}>
                  {plan.trialDays}-day free trial
                </span>
              )}
              <button
                type="button"
                onClick={() => handleSelect(plan.id)}
                disabled={selecting !== null}
                className="adm-focus-ring adm-btn adm-btn-primary mt-auto h-10 text-sm"
              >
                {selecting === plan.id ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {plan.basePriceInSmallestUnit === 0 ? "Start free" : "Choose plan"}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm" style={{ color: "var(--adm-danger)" }}>{error}</p>}
      <StepActions onSkip={onSkip} />
    </div>
  );
}

// ─── Team ───────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "counsellor", label: "Counsellor" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

export function TeamStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("counsellor");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    listTeamInvitations(1, 20).then((result) => {
      if (result.success) setInvitations(result.data.items);
    });
  }

  useEffect(refresh, []);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    const result = await sendTeamInvitation(email, role);
    setSending(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Couldn't send that invitation.");
      return;
    }
    setEmail("");
    refresh();
  }

  async function handleRevoke(id: string) {
    await revokeTeamInvitation(id);
    refresh();
  }

  return (
    <div>
      <StepHeading icon={Users} title="Invite your team" description="Add teammates now, or skip and invite them later from Settings." />

      <form onSubmit={handleInvite} className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@yourbusiness.com"
          className="adm-input adm-focus-ring h-10 w-full flex-1 sm:w-auto sm:min-w-[220px]"
        />
        <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="adm-input adm-focus-ring h-10 w-auto">
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={sending} className="adm-focus-ring adm-btn adm-btn-secondary h-10 text-sm">
          {sending ? <Loader2 size={14} className="animate-spin" /> : null}
          Send invite
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm" style={{ color: "var(--adm-danger)" }}>{error}</p>}

      {invitations.length > 0 && (
        <ul className="mt-4 space-y-2">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex items-center justify-between rounded-[var(--adm-radius-md)] px-3 py-2 text-sm" style={{ background: "var(--adm-surface-2)" }}>
              <span style={{ color: "var(--adm-text)" }}>
                {invitation.email} <span style={{ color: "var(--adm-text-muted)" }}>· {invitation.role}</span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    background: invitation.status === "pending" ? "var(--adm-warning-soft)" : "var(--adm-success-soft)",
                    color: invitation.status === "pending" ? "var(--adm-warning)" : "var(--adm-success)",
                  }}
                >
                  {invitation.status}
                </span>
                {invitation.status === "pending" && (
                  <button type="button" onClick={() => handleRevoke(invitation.id)} className="text-xs font-medium" style={{ color: "var(--adm-danger)" }}>
                    Revoke
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <StepActions onSkip={onSkip}>
        <button type="button" onClick={onComplete} className="adm-focus-ring adm-btn adm-btn-primary h-10 text-sm">
          <Check size={14} /> Continue
        </button>
      </StepActions>
    </div>
  );
}

// ─── WhatsApp ───────────────────────────────────────────────────────────

export function WhatsAppStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [status, setStatus] = useState<"loading" | "not_entitled" | "not_connected" | "connected">("loading");

  useEffect(() => {
    getWhatsAppEmbeddedSignupConfig().then((result) => {
      if (!result.success) return setStatus("not_connected");
      if (!result.data.entitled) return setStatus("not_entitled");
      setStatus("not_connected");
    });
  }, []);

  return (
    <div>
      <StepHeading icon={MessageCircle} title="Connect WhatsApp" description="Message leads and run campaigns directly from LearnSynaptic." />
      {status === "loading" ? (
        <Loader2 size={18} className="animate-spin" style={{ color: "var(--adm-accent)" }} />
      ) : status === "not_entitled" ? (
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          WhatsApp isn&apos;t included in your current plan yet. You can upgrade anytime from Settings to unlock it.
        </p>
      ) : (
        <div className="adm-card p-4">
          <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
            Not connected yet. WhatsApp functionality stays unavailable until you connect a real business number — you can do this now or anytime later
            from Settings → Integrations.
          </p>
          <Link href="/admin/settings#integrations" className="adm-focus-ring adm-btn adm-btn-primary mt-3 h-10 text-sm">
            <ExternalLink size={14} /> Connect WhatsApp in Settings
          </Link>
        </div>
      )}
      <StepActions onSkip={onSkip}>
        <button type="button" onClick={onComplete} className="adm-focus-ring adm-btn adm-btn-secondary h-10 text-sm">
          <Check size={14} /> I&apos;ll do this later
        </button>
      </StepActions>
    </div>
  );
}

// ─── Email ──────────────────────────────────────────────────────────────

export function EmailStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [serverToken, setServerToken] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    listIntegrations().then((result) => {
      if (!result.success) return;
      const email = result.data.integrations.find((i: IntegrationSummary) => i.provider.id === "email");
      if (email?.status === "connected") setConnected(true);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await setIntegrationCredentials("email", { serverToken, fromAddress });
    setSaving(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Couldn't save those credentials.");
      return;
    }
    onComplete();
  }

  return (
    <div>
      <StepHeading icon={Mail} title="Connect email" description="Send campaigns and transactional email from your own address." />
      {connected ? (
        <p className="text-sm" style={{ color: "var(--adm-success)" }}>
          Email is already connected for this organization.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="email-from" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
              Send-from address
            </label>
            <input
              id="email-from"
              type="email"
              value={fromAddress}
              onChange={(event) => setFromAddress(event.target.value)}
              placeholder="hello@yourbusiness.com"
              className="adm-input adm-focus-ring h-10"
            />
          </div>
          <div>
            <label htmlFor="email-token" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
              Provider API key
            </label>
            <input
              id="email-token"
              type="password"
              value={serverToken}
              onChange={(event) => setServerToken(event.target.value)}
              placeholder="••••••••"
              className="adm-input adm-focus-ring h-10"
            />
            <p className="mt-1 text-xs" style={{ color: "var(--adm-text-muted)" }}>
              Never shown again once saved. Full setup options are in Settings → Integrations.
            </p>
          </div>
          {error && <p role="alert" className="text-sm" style={{ color: "var(--adm-danger)" }}>{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !fromAddress || !serverToken}
            className="adm-focus-ring adm-btn adm-btn-primary h-10 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save and continue
          </button>
        </div>
      )}
      <StepActions onSkip={onSkip} />
    </div>
  );
}

// ─── AI ─────────────────────────────────────────────────────────────────

export function AiStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  return (
    <div>
      <StepHeading icon={Sparkles} title="AI-powered features" description="Lead scoring, AI-assisted replies, and conversation summaries." />
      <div className="adm-card p-4">
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          AI features work automatically using LearnSynaptic&apos;s shared credits — nothing to set up. If you&apos;d rather use your own AI provider
          account, you can connect one anytime from Settings → Integrations.
        </p>
      </div>
      <StepActions onSkip={onSkip}>
        <button type="button" onClick={onComplete} className="adm-focus-ring adm-btn adm-btn-primary h-10 text-sm">
          <Check size={14} /> Continue
        </button>
      </StepActions>
    </div>
  );
}

// ─── Calendar ───────────────────────────────────────────────────────────

export function CalendarStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  return (
    <div>
      <StepHeading icon={CalendarDays} title="Connect a calendar" description="Schedule meetings with leads directly from LearnSynaptic. Optional." />
      <div className="adm-card p-4">
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          Connect Google Calendar, Outlook, or Zoom from Settings → Integrations whenever you&apos;re ready.
        </p>
        <Link href="/admin/settings#integrations" className="adm-focus-ring adm-btn adm-btn-secondary mt-3 h-10 text-sm">
          <ExternalLink size={14} /> Open Integrations
        </Link>
      </div>
      <StepActions onSkip={onSkip}>
        <button type="button" onClick={onComplete} className="adm-focus-ring adm-btn adm-btn-primary h-10 text-sm">
          <Check size={14} /> Continue
        </button>
      </StepActions>
    </div>
  );
}

// ─── CRM Pipeline ───────────────────────────────────────────────────────

export function CrmStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPipelines().then((result) => {
      setLoading(false);
      if (result.success && result.data.pipelines.length > 0) setPipeline(result.data.pipelines[0]);
    });
  }, []);

  return (
    <div>
      <StepHeading icon={Workflow} title="Your sales pipeline" description="A default pipeline is ready to use — customize it anytime." />
      {loading ? (
        <Loader2 size={18} className="animate-spin" style={{ color: "var(--adm-accent)" }} />
      ) : pipeline ? (
        <div className="adm-card p-4">
          <p className="mb-2 text-sm font-medium" style={{ color: "var(--adm-text)" }}>
            {pipeline.name}
          </p>
          <div className="flex flex-wrap gap-2">
            {pipeline.stages.map((stage) => (
              <span key={stage.id} className="rounded-full px-2.5 py-1 text-xs" style={{ background: "var(--adm-surface-2)", color: "var(--adm-text-muted)" }}>
                {stage.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          Couldn&apos;t load your pipeline — you can set it up from CRM → Pipeline.
        </p>
      )}
      <StepActions onSkip={onSkip}>
        <button type="button" onClick={onComplete} className="adm-focus-ring adm-btn adm-btn-primary h-10 text-sm">
          <Check size={14} /> Looks good
        </button>
      </StepActions>
    </div>
  );
}

// ─── Import Leads ───────────────────────────────────────────────────────

export function ImportStep({ onComplete, onSkip }: { onComplete: () => void; onSkip: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ validRowCount: number; rejected: number } | null>(null);
  const [result, setResult] = useState<{ imported: number; duplicates: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setResult(null);
    setError(null);
    if (!selected) return;
    setBusy(true);
    const previewResult = await previewLeadImport(selected);
    setBusy(false);
    if (!previewResult.success) {
      setError(previewResult.errors[0]?.message ?? "Couldn't read that file.");
      return;
    }
    setPreview({ validRowCount: previewResult.data.validRowCount, rejected: previewResult.data.rejected.length });
  }

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const commitResult = await commitLeadImport(file);
    setBusy(false);
    if (!commitResult.success) {
      setError(commitResult.errors[0]?.message ?? "Import failed.");
      return;
    }
    setResult({ imported: commitResult.data.imported, duplicates: commitResult.data.duplicates });
  }

  return (
    <div>
      <StepHeading icon={Upload} title="Import your leads" description="Bring in an existing contact list as a CSV — optional." />
      <div className="adm-card space-y-3 p-4">
        <input type="file" accept=".csv" onChange={handleFileChange} className="text-sm" style={{ color: "var(--adm-text)" }} />
        {preview && !result && (
          <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
            {preview.validRowCount} row{preview.validRowCount === 1 ? "" : "s"} ready to import
            {preview.rejected > 0 ? `, ${preview.rejected} will be skipped (missing required fields)` : ""}.
          </p>
        )}
        {result && (
          <p className="text-sm" style={{ color: "var(--adm-success)" }}>
            Imported {result.imported} lead{result.imported === 1 ? "" : "s"}
            {result.duplicates > 0 ? ` (${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"} skipped)` : ""}.
          </p>
        )}
        {error && <p role="alert" className="text-sm" style={{ color: "var(--adm-danger)" }}>{error}</p>}
        {preview && !result && (
          <button type="button" onClick={handleImport} disabled={busy} className="adm-focus-ring adm-btn adm-btn-primary h-10 text-sm">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Import {preview.validRowCount} lead{preview.validRowCount === 1 ? "" : "s"}
          </button>
        )}
      </div>
      <StepActions onSkip={onSkip}>
        {result && (
          <button type="button" onClick={onComplete} className="adm-focus-ring adm-btn adm-btn-primary h-10 text-sm">
            <Check size={14} /> Continue
          </button>
        )}
      </StepActions>
    </div>
  );
}
