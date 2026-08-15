"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  ArrowUpRight,
  Command,
} from "lucide-react";
import { useAdminAuth } from "./AdminAuthContext";
import { useAdminTheme } from "./AdminThemeContext";
import { useAdminShellState } from "./AdminShellState";
import { listAuditLogs } from "./apiClient";
import type { AuditLogEntry } from "@/lib/services/auditLog";
import { NAV_SEARCH_INDEX, navItemVisible } from "./navIndex";

/** Closes on outside click via a real listener rather than an invisible
 *  `fixed inset-0` catcher — the header uses `backdrop-filter`, which
 *  (per spec) creates a new containing block for `position: fixed`
 *  descendants, shrinking any such catcher rendered inside the header
 *  down to the header's own bounds instead of the full viewport. */
function useClickOutside<T extends HTMLElement>(active: boolean, onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!active) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, onOutside]);
  return ref;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAdminAuth();

  // Reset search when the palette opens — adjust during render rather than
  // setState inside an effect (react-hooks/set-state-in-effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const visibleNavIndex = useMemo(
    () => NAV_SEARCH_INDEX.filter((item) => navItemVisible(item.minRole, user?.role)),
    [user?.role],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleNavIndex;
    return visibleNavIndex.filter(
      (item) => item.label.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q)),
    );
  }, [query, visibleNavIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-24" role="dialog" aria-modal="true" aria-label="Quick navigation">
      <div className="absolute inset-0" style={{ background: "var(--adm-overlay)" }} onClick={onClose} />
      <div
        className="adm-animate-pop relative w-full max-w-lg overflow-hidden rounded-[var(--adm-radius-lg)] border shadow-2xl"
        style={{ background: "var(--adm-bg-elevated)", borderColor: "var(--adm-border-strong)" }}
      >
        <div className="flex items-center gap-2.5 border-b px-4" style={{ borderColor: "var(--adm-border)" }}>
          <Search size={16} style={{ color: "var(--adm-text-muted)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results[0]) {
                router.push(results[0].href);
                onClose();
              }
            }}
            placeholder="Jump to a section…"
            aria-label="Search dashboard sections"
            className="h-12 w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--adm-text)" }}
          />
          <kbd
            className="rounded-[var(--adm-radius-sm)] border px-1.5 py-0.5 text-[10px] font-medium"
            style={{ borderColor: "var(--adm-border)", color: "var(--adm-text-muted)" }}
          >
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm" style={{ color: "var(--adm-text-muted)" }}>
              No sections match &ldquo;{query}&rdquo;.
            </p>
          )}
          {results.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="adm-focus-ring flex items-center gap-3 rounded-[var(--adm-radius-md)] px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--adm-surface-hover)]"
              style={{ color: "var(--adm-text)" }}
            >
              <item.icon size={16} style={{ color: "var(--adm-text-muted)" }} />
              {item.label}
              <ArrowUpRight size={14} className="ml-auto" style={{ color: "var(--adm-text-muted)" }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const ref = useClickOutside<HTMLDivElement>(open, onClose);

  useEffect(() => {
    if (!open || entries !== null) return;
    listAuditLogs({}, 1, 6).then((result) => {
      if (result.success) setEntries(result.data.items);
    });
  }, [open, entries]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="adm-animate-pop absolute right-0 top-[calc(100%+8px)] z-[66] w-80 overflow-hidden rounded-[var(--adm-radius-lg)] border shadow-2xl"
      style={{ background: "var(--adm-bg-elevated)", borderColor: "var(--adm-border-strong)" }}
    >
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--adm-border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            Recent activity
          </p>
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            Live from the audit log
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {entries === null && (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="adm-skeleton h-10 rounded-[var(--adm-radius-md)]" />
              ))}
            </div>
          )}
          {entries?.length === 0 && (
            <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--adm-text-muted)" }}>
              No activity recorded yet.
            </p>
          )}
          {entries?.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 border-b px-4 py-3 last:border-0" style={{ borderColor: "var(--adm-border)" }}>
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: entry.category === "security" ? "var(--adm-warning)" : "var(--adm-accent)" }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: "var(--adm-text)" }}>
                  {entry.action.replace(/[._]/g, " ")}
                </p>
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  {entry.entityType} · {formatRelativeTime(entry.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <Link
          href="/admin/audit-logs"
          onClick={onClose}
          className="adm-focus-ring block px-4 py-3 text-center text-xs font-semibold transition-colors hover:bg-[var(--adm-surface-hover)]"
          style={{ color: "var(--adm-accent)" }}
        >
          View all activity
        </Link>
      </div>
  );
}

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/analytics": "Analytics",
  "/admin/leads": "Leads",
  "/admin/pipeline": "Pipeline",
  "/admin/tasks": "Tasks",
  "/admin/campaigns": "Campaigns",
  "/admin/registrations": "Registrations",
  "/admin/attendance": "Attendance",
  "/admin/whatsapp": "WhatsApp",
  "/admin/automation": "Workflows",
  "/admin/templates": "Templates",
  "/admin/contacts": "Contacts",
  "/admin/audit-logs": "Audit Logs",
  "/admin/settings": "Settings",
};

function currentTitle(pathname: string | null): string {
  if (!pathname) return "Dashboard";
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES).find((key) => key !== "/admin" && pathname.startsWith(key));
  return match ? PAGE_TITLES[match] : "Dashboard";
}

export function DashboardHeader() {
  const { user, logout } = useAdminAuth();
  const { theme, toggleTheme } = useAdminTheme();
  const { setMobileOpen } = useAdminShellState();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const initials = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();
  const menuRef = useClickOutside<HTMLDivElement>(menuOpen, () => setMenuOpen(false));

  return (
    <>
      <header
        className="sticky top-0 z-40 flex h-[var(--adm-header-h)] items-center gap-3 border-b px-4 sm:px-6"
        style={{ borderColor: "var(--adm-border)", background: "color-mix(in srgb, var(--adm-bg-elevated) 88%, transparent)", backdropFilter: "blur(16px)" }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="adm-focus-ring adm-icon-btn lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        <div className="min-w-0">
          <h1 className="truncate !text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            {currentTitle(pathname)}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="adm-focus-ring ml-2 hidden min-w-0 flex-1 items-center gap-2 rounded-[var(--adm-radius-md)] border px-3 py-1.5 text-left text-sm md:flex md:max-w-xs"
          style={{ borderColor: "var(--adm-border)", background: "var(--adm-surface-2)", color: "var(--adm-text-muted)" }}
        >
          <Search size={14} />
          <span className="truncate">Search dashboard…</span>
          <span className="ml-auto flex items-center gap-0.5 text-[10px]">
            <Command size={11} />K
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="adm-focus-ring adm-icon-btn md:hidden"
            aria-label="Search"
          >
            <Search size={17} />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="adm-focus-ring adm-icon-btn"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="adm-focus-ring adm-icon-btn"
              aria-label="Recent activity"
              aria-expanded={notifOpen}
            >
              <Bell size={17} />
            </button>
            <NotificationsPopover open={notifOpen} onClose={() => setNotifOpen(false)} />
          </div>

          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="adm-focus-ring flex items-center gap-2 rounded-[var(--adm-radius-md)] py-1 pl-1 pr-2 transition-colors hover:bg-[var(--adm-surface-hover)]"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg, var(--adm-accent), var(--adm-accent-2))" }}
              >
                {initials}
              </span>
              {user && (
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[9rem] truncate text-xs font-semibold" style={{ color: "var(--adm-text)" }}>
                    {user.name || user.email}
                  </span>
                  <span className="block text-[11px] capitalize" style={{ color: "var(--adm-text-muted)" }}>
                    {user.role}
                  </span>
                </span>
              )}
            </button>
            {menuOpen && (
                <div
                  ref={menuRef}
                  className="adm-animate-pop absolute right-0 top-[calc(100%+8px)] z-[66] w-52 overflow-hidden rounded-[var(--adm-radius-lg)] border shadow-2xl"
                  style={{ background: "var(--adm-bg-elevated)", borderColor: "var(--adm-border-strong)" }}
                >
                  <div className="border-b px-3.5 py-3" style={{ borderColor: "var(--adm-border)" }}>
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
                      {user?.email}
                    </p>
                    <p className="text-xs capitalize" style={{ color: "var(--adm-text-muted)" }}>
                      {user?.role} account
                    </p>
                  </div>
                  <Link
                    href="/"
                    className="adm-focus-ring block px-3.5 py-2.5 text-sm transition-colors hover:bg-[var(--adm-surface-hover)]"
                    style={{ color: "var(--adm-text-secondary)" }}
                  >
                    View public site
                  </Link>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="adm-focus-ring flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--adm-danger-soft)]"
                    style={{ color: "var(--adm-danger)" }}
                  >
                    <LogOut size={14} /> Log out
                  </button>
                </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
