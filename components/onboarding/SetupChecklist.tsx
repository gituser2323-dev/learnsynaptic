"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X, Workflow, Megaphone, ChevronRight } from "lucide-react";
import { getOnboardingStatus, type OnboardingStepId } from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";

/**
 * RC-7 — Customer Onboarding & SaaS Activation. Mission §28's own
 * "lightweight setup checklist" — rendered on the main dashboard for
 * an organization that hasn't finished every optional step, backed by
 * the SAME real per-organization `onboarding.steps` state the wizard
 * itself writes (never a second, parallel progress concept). Mission's
 * own explicit "do not force users back through the wizard for
 * optional tasks" — every row here links straight to the real feature
 * page (Settings, CRM Import, Team), never back into /admin/onboarding.
 *
 * Dismissible for the current session only (not persisted — a user who
 * dismisses it and reloads sees it again if genuinely still
 * incomplete; this is a nudge, not a permanent setting worth its own
 * server-side flag).
 */

const CHECKLIST_ITEMS: { step: OnboardingStepId; label: string; href: string }[] = [
  { step: "team", label: "Invite your team", href: "/admin/onboarding" },
  { step: "whatsapp", label: "Connect WhatsApp", href: "/admin/settings#integrations" },
  { step: "email", label: "Connect email", href: "/admin/settings#integrations" },
  { step: "calendar", label: "Connect a calendar", href: "/admin/settings#integrations" },
  { step: "import", label: "Import your leads", href: "/admin/leads" },
];

export function SetupChecklist() {
  const { data } = useAdminData(getOnboardingStatus, []);
  const [dismissed, setDismissed] = useState(false);

  const status = data?.status;
  if (!status || status.resumeStep !== "done" || dismissed) return null;

  const pending = CHECKLIST_ITEMS.filter((item) => !status.steps[item.step]);
  if (pending.length === 0) return null;

  return (
    <div className="adm-card adm-animate-in p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Finish setting up your workspace
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-muted)" }}>
            {pending.length} optional step{pending.length === 1 ? "" : "s"} left — do these whenever you&apos;re ready.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="adm-focus-ring rounded-[var(--adm-radius-sm)] p-1"
          style={{ color: "var(--adm-text-muted)" }}
          aria-label="Dismiss checklist"
        >
          <X size={16} />
        </button>
      </div>

      <ul className="space-y-1.5">
        {CHECKLIST_ITEMS.map((item) => {
          const done = Boolean(status.steps[item.step]);
          return (
            <li key={item.step}>
              <Link
                href={item.href}
                className="adm-focus-ring flex items-center justify-between gap-2 rounded-[var(--adm-radius-md)] px-2.5 py-1.5 text-sm transition-colors hover:bg-[var(--adm-surface-hover)]"
              >
                <span className="flex items-center gap-2" style={{ color: done ? "var(--adm-text-muted)" : "var(--adm-text)" }}>
                  {done ? <CheckCircle2 size={16} style={{ color: "var(--adm-success)" }} /> : <Circle size={16} />}
                  <span style={done ? { textDecoration: "line-through" } : undefined}>{item.label}</span>
                </span>
                {!done && <ChevronRight size={14} style={{ color: "var(--adm-text-muted)" }} />}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--adm-border)" }}>
        <Link href="/admin/campaigns" className="adm-focus-ring adm-btn adm-btn-secondary h-8 text-xs">
          <Megaphone size={13} /> Create your first campaign
        </Link>
        <Link href="/admin/automation" className="adm-focus-ring adm-btn adm-btn-secondary h-8 text-xs">
          <Workflow size={13} /> Set up your first automation
        </Link>
      </div>
    </div>
  );
}
