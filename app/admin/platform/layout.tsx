"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, LayoutDashboard, Building2, ListChecks, Lock, TrendingUp } from "lucide-react";
import { AdminAuthProvider, useAdminAuth } from "@/components/admin/AdminAuthContext";
import { AdminThemeProvider, useAdminTheme } from "@/components/admin/AdminThemeContext";
import { LoadingState } from "@/components/admin/DataStates";

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console.
 *
 * Deliberately a SEPARATE top-level route (`/admin/platform`, outside
 * `app/admin/(dashboard)`) with its own layout, its own nav, and
 * (deliberately) NO `AdminBrandingProvider` — tenant white-label
 * branding is irrelevant to, and actively confusing for, a platform
 * operator managing every organization at once. The mission's own
 * explicit "must remain completely separate from ordinary tenant
 * administration... do NOT mix platform operations into normal tenant
 * CRM navigation" is satisfied structurally: nothing in
 * `app/admin/(dashboard)` links here, and this layout never renders
 * the tenant Sidebar/DashboardHeader.
 *
 * Reuses `AdminAuthProvider`/`AdminThemeProvider` as-is (identity and
 * dark/light theme are legitimately shared concerns) and the same
 * `adm-*` design tokens/utility classes as the rest of the admin
 * surface (StatCard, Table, Badge, DataStates — the mission's own
 * "use the existing premium design language" instruction) — but with a
 * persistent amber banner and a distinct nav so an operator always
 * knows they're at SaaS/platform scope, not inside any one tenant's
 * CRM.
 *
 * ⚠️ This client-side gate (hiding nav/showing "Access Denied" for a
 * non-platform user) is a UX nicety, NOT the real security boundary —
 * every `/api/admin/platform/*` route enforces `requiredPlatformRole`
 * server-side regardless of what renders here (see withApiRoute.ts's
 * own doc comment: "hiding UI is not security").
 */

const NAV_ITEMS = [
  { href: "/admin/platform", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/platform/organizations", label: "Organizations", icon: Building2, exact: false },
  { href: "/admin/platform/onboarding", label: "Onboarding", icon: TrendingUp, exact: false },
  { href: "/admin/platform/jobs", label: "Jobs & Queue", icon: ListChecks, exact: false },
  { href: "/admin/platform/security", label: "Security Events", icon: Lock, exact: false },
];

function PlatformShell({ children }: { children: React.ReactNode }) {
  const { theme } = useAdminTheme();
  const { user, loading } = useAdminAuth();
  const pathname = usePathname();

  return (
    <div className="admin-shell min-h-screen" data-theme={theme}>
      <div
        className="flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide"
        style={{ background: "var(--adm-warning-soft)", color: "var(--adm-warning)" }}
      >
        <ShieldAlert size={14} />
        Platform Operations Console — LearnSynaptic SaaS Owner Access, not a tenant workspace
      </div>

      <header
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
        style={{ borderBottom: "1px solid var(--adm-border)" }}
      >
        <div className="flex items-center gap-4">
          <Link href="/admin/platform" className="font-bold" style={{ color: "var(--adm-text)" }}>
            LearnSynaptic <span style={{ color: "var(--adm-warning)" }}>Platform</span>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="adm-focus-ring flex items-center gap-1.5 rounded-[var(--adm-radius-md)] px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    color: active ? "var(--adm-text)" : "var(--adm-text-secondary)",
                    background: active ? "var(--adm-surface-2)" : "transparent",
                  }}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/admin" className="adm-focus-ring" style={{ color: "var(--adm-text-muted)" }}>
            ← Back to tenant admin
          </Link>
          {user && <span style={{ color: "var(--adm-text-secondary)" }}>{user.email}</span>}
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8">
        {loading ? (
          <LoadingState label="Checking platform access…" />
        ) : !user?.platformRole ? (
          <div className="adm-card adm-animate-in flex flex-col items-center gap-3 px-6 py-16 text-center">
            <ShieldAlert size={32} style={{ color: "var(--adm-warning)" }} />
            <p className="font-semibold" style={{ color: "var(--adm-text)" }}>
              Platform access required
            </p>
            <p className="max-w-sm text-sm" style={{ color: "var(--adm-text-muted)" }}>
              This account does not have Platform Super Admin access. If you believe this is an
              error, contact whoever manages platform operator accounts for this deployment.
            </p>
            <Link href="/admin" className="adm-focus-ring adm-btn adm-btn-secondary">
              Back to tenant admin
            </Link>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminThemeProvider>
        <PlatformShell>{children}</PlatformShell>
      </AdminThemeProvider>
    </AdminAuthProvider>
  );
}
