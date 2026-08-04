"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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

export function AdminShellStateProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const value = useMemo<AdminShellStateValue>(
    () => ({
      collapsed,
      toggleCollapsed: () =>
        setCollapsed((prev) => {
          const next = !prev;
          window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
          return next;
        }),
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
