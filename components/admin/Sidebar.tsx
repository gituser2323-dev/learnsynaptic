"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useAdminShellState } from "./AdminShellState";
import { useAdminAuth } from "./AdminAuthContext";
import { useAdminBranding } from "./AdminBrandingContext";
import { NAV_SEARCH_INDEX, NAV_GROUPS, navItemVisible } from "./navIndex";

function NavLink({
  href,
  label,
  Icon,
  isActive,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? label : undefined}
      className="adm-focus-ring group relative flex items-center gap-3 rounded-[var(--adm-radius-md)] px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        color: isActive ? "var(--adm-text)" : "var(--adm-text-secondary)",
        background: isActive ? "var(--adm-surface-2)" : "transparent",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-[var(--adm-accent)] transition-all duration-200"
        style={{ width: isActive ? 3 : 0 }}
      />
      <Icon size={18} strokeWidth={isActive ? 2.25 : 1.9} />
      {!collapsed && <span className="truncate">{label}</span>}
      {isActive && !collapsed && (
        <span
          aria-hidden="true"
          className="ml-auto h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--adm-accent)" }}
        />
      )}
    </Link>
  );
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAdminAuth();
  const { branding } = useAdminBranding();

  return (
    <>
      <Link
        href="/admin"
        onClick={onNavigate}
        className="adm-focus-ring mb-5 flex items-center gap-2.5 rounded-[var(--adm-radius-md)] px-2 py-1.5"
      >
        {/* Business OS Phase 8, Module 8.4 — an entitled, configured
         *  organization's own compact logo replaces the default mark;
         *  every other org (no entitlement, or entitled-but-
         *  unconfigured) renders the exact same LearnSynaptic gradient
         *  square this always showed, zero visual change. */}
        {branding.compactLogoUrl ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[var(--adm-radius-sm)]" style={{ background: "var(--adm-surface-2)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a tenant-supplied, per-organization asset URL (signed/local-provider), not a static build-time asset next/image can optimize */}
            <img src={branding.compactLogoUrl} alt="" width={32} height={32} className="h-full w-full object-contain" />
          </span>
        ) : (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--adm-radius-sm)]"
            style={{ background: "linear-gradient(135deg, var(--adm-accent), var(--adm-accent-2))" }}
          >
            <Image src="/logo.png" alt="" width={18} height={18} className="rounded-sm" />
          </span>
        )}
        {!collapsed && (
          <span className="flex flex-col leading-none">
            <span className="truncate text-sm font-bold tracking-tight" style={{ color: "var(--adm-text)" }}>
              {branding.displayName}
            </span>
            <span className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--adm-text-muted)" }}>
              Admin Workspace
            </span>
          </span>
        )}
      </Link>

      <nav aria-label="Dashboard navigation" className="flex-1 space-y-5 overflow-y-auto pr-0.5">
        {NAV_GROUPS.map((group) => {
          const items = NAV_SEARCH_INDEX.filter((item) => item.group === group && navItemVisible(item.minRole, user?.role));
          if (items.length === 0) return null;
          return (
            <div key={group}>
              {!collapsed && (
                <p
                  className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.09em]"
                  style={{ color: "var(--adm-text-muted)" }}
                >
                  {group}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map(({ href, label, icon: Icon }) => {
                  const isActive = href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href);
                  return (
                    <NavLink
                      key={href}
                      href={href}
                      label={label}
                      Icon={Icon}
                      isActive={!!isActive}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </>
  );
}

/** Desktop rail — collapsible, always visible at lg+. */
export function Sidebar() {
  const { collapsed, toggleCollapsed } = useAdminShellState();

  return (
    <aside
      className="sticky top-0 hidden h-screen shrink-0 flex-col border-r p-3 transition-[width] duration-200 lg:flex"
      style={{
        width: collapsed ? "var(--adm-sidebar-w-collapsed)" : "var(--adm-sidebar-w)",
        borderColor: "var(--adm-border)",
        background: "var(--adm-bg-elevated)",
      }}
    >
      <SidebarContent collapsed={collapsed} />
      <button
        type="button"
        onClick={toggleCollapsed}
        className="adm-focus-ring adm-icon-btn mt-2 self-end"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
      </button>
    </aside>
  );
}

/** Mobile/tablet slide-over — rendered by the dashboard layout below lg. */
export function MobileSidebar() {
  const { mobileOpen, setMobileOpen } = useAdminShellState();

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      style={{
        visibility: mobileOpen ? "visible" : "hidden",
        pointerEvents: mobileOpen ? "auto" : "none",
      }}
      aria-hidden={!mobileOpen}
    >
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ background: "var(--adm-overlay)", opacity: mobileOpen ? 1 : 0 }}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className="absolute left-0 top-0 flex h-full w-[82vw] max-w-[300px] flex-col border-r p-4 shadow-2xl transition-transform duration-300"
        style={{
          borderColor: "var(--adm-border)",
          background: "var(--adm-bg-elevated)",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard navigation"
      >
        <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
      </aside>
    </div>
  );
}
