"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

interface AdminShellStateValue {
  /** Desktop rail: full width vs. icon-only. Persisted — a deliberate,
   *  sticky preference, unlike mobileOpen below. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Mobile/tablet slide-over drawer. Never persisted — always closed on
   *  a fresh load, and closed automatically on navigation. */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const STORAGE_KEY = "ls-admin-sidebar-collapsed";

const AdminShellStateContext = createContext<AdminShellStateValue | undefined>(undefined);

function subscribeCollapsed(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getCollapsedSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function getCollapsedServerSnapshot() {
  return false;
}

export function AdminShellStateProvider({ children }: { children: ReactNode }) {
  const storedCollapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  const collapsed = collapsedOverride ?? storedCollapsed;
  const [mobileOpen, setMobileOpen] = useState(false);

  const value = useMemo<AdminShellStateValue>(
    () => ({
      collapsed,
      toggleCollapsed: () => {
        const next = !collapsed;
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        setCollapsedOverride(next);
      },
      mobileOpen,
      setMobileOpen,
    }),
    [collapsed, mobileOpen],
  );

  return <AdminShellStateContext.Provider value={value}>{children}</AdminShellStateContext.Provider>;
}

export function useAdminShellState(): AdminShellStateValue {
  const context = useContext(AdminShellStateContext);
  if (!context) throw new Error("useAdminShellState must be used inside AdminShellStateProvider");
  return context;
}
