"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Mail, Building2, PartyPopper, Check } from "lucide-react";
import {
  getOnboardingStatus,
  createOnboardingOrganization,
  markOnboardingStep,
  resendVerificationEmail,
  logout,
  type OnboardingStatusResponse,
  type OnboardingStepId,
  type OnboardingOrganization,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { PlanStep, TeamStep, WhatsAppStep, EmailStep, AiStep, CalendarStep, CrmStep, ImportStep } from "@/components/onboarding/WizardSteps";

/**
 * /admin/onboarding — RC-7 Customer Onboarding & SaaS Activation. The
 * premium guided wizard the mission asks for (§10), built entirely
 * from this app's EXISTING design system (adm-card/adm-btn/adm-input/
 * the same gradient auth shell /admin/login and /admin/register
 * already use) — no new visual language invented.
 *
 * Resolves everything from GET /api/onboarding/status (mission §34's
 * own "resolve onboarding state server-side" instruction) rather than
 * trusting any client-side/localStorage flag — a user who starts
 * onboarding, closes the tab, and logs back in days later lands
 * exactly where this route says they should, every time.
 */

const STEP_ORDER: OnboardingStepId[] = ["plan", "team", "whatsapp", "email", "ai", "calendar", "crm", "import"];
const STEP_LABELS: Record<OnboardingStepId, string> = {
  plan: "Plan",
  team: "Team",
  whatsapp: "WhatsApp",
  email: "Email",
  ai: "AI",
  calendar: "Calendar",
  crm: "CRM",
  import: "Import leads",
};

function firstPendingStep(steps: OnboardingStatusResponse["steps"]): OnboardingStepId | null {
  return STEP_ORDER.find((step) => !steps[step]) ?? null;
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="admin-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10" data-theme="dark">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 620px 420px at 50% 0%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(ellipse 500px 360px at 100% 100%, rgba(34,211,238,0.12), transparent 55%)",
        }}
      />
      <div className="adm-animate-in relative w-full max-w-lg">
        <div className="adm-glass adm-card rounded-[var(--adm-radius-xl)] p-8 shadow-2xl">{children}</div>
      </div>
    </main>
  );
}

function BrandHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-7 flex flex-col items-center gap-3 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-[var(--adm-radius-lg)]"
        style={{ background: "linear-gradient(135deg, var(--adm-accent), var(--adm-accent-2))" }}
      >
        <Image src="/logo.png" alt="" width={24} height={24} className="rounded-sm" />
      </span>
      <div>
        <h1 className="!text-lg font-bold" style={{ color: "var(--adm-text)" }}>
          {title}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--adm-text-muted)" }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function VerifyEmailScreen() {
  const [sent, setSent] = useState(false);
  const router = useRouter();

  async function handleResend() {
    const result = await resendVerificationEmail();
    setSent(result.success);
  }

  async function handleLogout() {
    await logout();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <AuthShell>
      <BrandHeader title="Check your email" subtitle="Verify your address to continue setting up your workspace." />
      <div className="space-y-4 text-center">
        <Mail size={32} className="mx-auto" style={{ color: "var(--adm-accent)" }} />
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          We sent a verification link to your email. Click it to continue — this page will pick up automatically once you&apos;re verified.
        </p>
        {sent && (
          <p className="text-xs" style={{ color: "var(--adm-success)" }}>
            Verification email sent again.
          </p>
        )}
        <button type="button" onClick={handleResend} className="adm-focus-ring adm-btn adm-btn-secondary h-10 w-full text-sm">
          Resend email
        </button>
        <button type="button" onClick={handleLogout} className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          Sign out
        </button>
      </div>
    </AuthShell>
  );
}

const TEAM_SIZES: { value: NonNullable<OnboardingOrganization["teamSize"]>; label: string }[] = [
  { value: "1-10", label: "1–10 people" },
  { value: "11-50", label: "11–50 people" },
  { value: "51-200", label: "51–200 people" },
  { value: "201-1000", label: "201–1,000 people" },
  { value: "1000+", label: "1,000+ people" },
];

function BusinessSetupScreen({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState<OnboardingOrganization["teamSize"] | "">("");
  const [website, setWebsite] = useState("");
  // Lazy initializer (runs once, at mount) rather than an effect —
  // this only ever needs to set the form's STARTING value from the
  // browser's own timezone guess, never react to anything changing
  // afterward, so there's no real "effect" here at all, just a
  // one-time derived initial state.
  const [country, setCountry] = useState(() => {
    try {
      const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return guess.startsWith("Asia/Kol") ? "IN" : "";
    } catch {
      // Best-effort only — the server has its own honest UTC/IN default.
      return "";
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await createOnboardingOrganization({
      name,
      industry: industry || undefined,
      teamSize: teamSize || undefined,
      website: website || undefined,
      country: country || undefined,
    });
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    // The session's own access token was minted before this
    // organization existed — refresh now so the very next request
    // already carries the real organizationId (see the route's own
    // doc comment for why this can't happen inline in that response).
    await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    onCreated();
  }

  return (
    <AuthShell>
      <BrandHeader title="Tell us about your business" subtitle="Just the essentials — you can change this anytime." />
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="org-name" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
            Business name
          </label>
          <input
            id="org-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Learning Co."
            className="adm-input adm-focus-ring h-11"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="org-industry" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
              Industry <span style={{ color: "var(--adm-text-muted)" }}>(optional)</span>
            </label>
            <input
              id="org-industry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              placeholder="Education"
              className="adm-input adm-focus-ring h-11"
            />
          </div>
          <div>
            <label htmlFor="org-team-size" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
              Team size
            </label>
            <select
              id="org-team-size"
              value={teamSize}
              onChange={(event) => setTeamSize(event.target.value as OnboardingOrganization["teamSize"])}
              className="adm-input adm-focus-ring h-11"
            >
              <option value="">Prefer not to say</option>
              {TEAM_SIZES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="org-website" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
              Website <span style={{ color: "var(--adm-text-muted)" }}>(optional)</span>
            </label>
            <input
              id="org-website"
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://yourbusiness.com"
              className="adm-input adm-focus-ring h-11"
            />
          </div>
          <div>
            <label htmlFor="org-country" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
              Country
            </label>
            <input
              id="org-country"
              value={country}
              onChange={(event) => setCountry(event.target.value.toUpperCase().slice(0, 2))}
              placeholder="IN"
              maxLength={2}
              className="adm-input adm-focus-ring h-11"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-[var(--adm-radius-md)] px-3 py-2 text-sm font-medium" style={{ background: "var(--adm-danger-soft)", color: "var(--adm-danger)" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading || !name} className="adm-focus-ring adm-btn adm-btn-primary h-11 w-full text-sm disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
          Create workspace
        </button>
      </form>
    </AuthShell>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6 flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, index) => (
        <div
          key={index}
          className="h-1.5 flex-1 rounded-full transition-colors"
          style={{ background: index < current ? "var(--adm-accent)" : "var(--adm-border)" }}
        />
      ))}
    </div>
  );
}

function FinishScreen({ organizationName }: { organizationName: string }) {
  const router = useRouter();
  return (
    <AuthShell>
      <div className="space-y-4 text-center">
        <PartyPopper size={36} className="mx-auto" style={{ color: "var(--adm-accent)" }} />
        <h1 className="text-xl font-bold" style={{ color: "var(--adm-text)" }}>
          {organizationName} is ready
        </h1>
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          Your workspace is set up. You can revisit any of the steps you skipped anytime from your setup checklist on the dashboard.
        </p>
        <button
          type="button"
          onClick={() => {
            router.push("/admin");
            router.refresh();
          }}
          className="adm-focus-ring adm-btn adm-btn-primary h-11 w-full text-sm"
        >
          <Check size={16} /> Go to dashboard
        </button>
      </div>
    </AuthShell>
  );
}

function WizardScreen({ status, onStepDone }: { status: OnboardingStatusResponse; onStepDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const currentStep = firstPendingStep(status.steps);

  if (!currentStep || !status.organization) {
    return <FinishScreen organizationName={status.organization?.name ?? "Your workspace"} />;
  }

  async function act(nextStatus: "completed" | "skipped") {
    setBusy(true);
    await markOnboardingStep(currentStep!, nextStatus);
    setBusy(false);
    onStepDone();
  }

  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const stepProps = { onComplete: () => act("completed"), onSkip: () => act("skipped") };

  return (
    <main id="main-content" className="admin-shell relative min-h-screen overflow-hidden px-4 py-10" data-theme="dark">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 620px 420px at 50% 0%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(ellipse 500px 360px at 100% 100%, rgba(34,211,238,0.10), transparent 55%)",
        }}
      />
      <div className="adm-animate-in relative mx-auto w-full max-w-2xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--adm-radius-md)]"
              style={{ background: "linear-gradient(135deg, var(--adm-accent), var(--adm-accent-2))" }}
            >
              <Image src="/logo.png" alt="" width={16} height={16} className="rounded-sm" />
            </span>
            <span className="truncate text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
              {status.organization.name}
            </span>
          </div>
          <span className="flex-shrink-0 text-xs" style={{ color: "var(--adm-text-muted)" }}>
            Step {stepIndex + 1} of {STEP_ORDER.length} · {STEP_LABELS[currentStep]}
          </span>
        </div>

        <div className="adm-glass adm-card rounded-[var(--adm-radius-xl)] p-8 shadow-2xl" style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
          <ProgressBar current={stepIndex + 1} total={STEP_ORDER.length} />
          {currentStep === "plan" && <PlanStep {...stepProps} />}
          {currentStep === "team" && <TeamStep {...stepProps} />}
          {currentStep === "whatsapp" && <WhatsAppStep {...stepProps} />}
          {currentStep === "email" && <EmailStep {...stepProps} />}
          {currentStep === "ai" && <AiStep {...stepProps} />}
          {currentStep === "calendar" && <CalendarStep {...stepProps} />}
          {currentStep === "crm" && <CrmStep {...stepProps} />}
          {currentStep === "import" && <ImportStep {...stepProps} />}
        </div>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  const { data, loading, reload } = useAdminData(getOnboardingStatus, []);
  const status = data?.status ?? null;

  if (loading || !status) {
    return (
      <main className="admin-shell flex min-h-screen items-center justify-center" data-theme="dark">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--adm-accent)" }} />
      </main>
    );
  }

  if (status.resumeStep === "verify_email") return <VerifyEmailScreen />;
  if (status.resumeStep === "create_organization") return <BusinessSetupScreen onCreated={reload} />;
  // RC-7 — deliberately NOT an auto-redirect the moment this flips to
  // "done" (an earlier version did this and it meant a user who just
  // finished the last wizard step never actually saw the "your
  // workspace is ready" confirmation — WizardScreen's own FinishScreen
  // fallback lost the race against this effect every time, live-tested
  // and confirmed). Both "just finished" and "came back later after
  // already finishing" land on the exact same real confirmation
  // screen now; leaving is always the user's own click, never a
  // surprise navigation.
  if (status.resumeStep === "done") return <FinishScreen organizationName={status.organization?.name ?? "Your workspace"} />;

  return <WizardScreen status={status} onStepDone={reload} />;
}
