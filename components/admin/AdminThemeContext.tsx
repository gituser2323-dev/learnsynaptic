"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

export type AdminTheme = "dark" | "light";

const STORAGE_KEY = "ls-admin-theme";

interface AdminThemeContextValue {
  theme: AdminTheme;
  toggleTheme: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue | undefined>(undefined);

function readStoredTheme(): AdminTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

function subscribeTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getThemeServerSnapshot(): AdminTheme {
  return "dark";
}

/**
 * Dark-first by design (see the redesign brief) — falls back to dark
 * whenever nothing's been saved yet, rather than reading the OS
 * preference, so a fresh admin session always opens in the intended
 * default look. Scoped to a `data-theme` attribute on .admin-shell only
 * (see globals.css) — never touches `<html>`, so it can't leak into the
 * public site's own light-only design system.
 */
export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const storedTheme = useSyncExternalStore(subscribeTheme, readStoredTheme, getThemeServerSnapshot);
  const [themeOverride, setThemeOverride] = useState<AdminTheme | null>(null);
  const theme = themeOverride ?? storedTheme;

  const value = useMemo<AdminThemeContextValue>(
    () => ({
      theme,
      toggleTheme: () => {
        const next: AdminTheme = theme === "dark" ? "light" : "dark";
        window.localStorage.setItem(STORAGE_KEY, next);
        setThemeOverride(next);
      },
    }),
    [theme],
  );

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme(): AdminThemeContextValue {
  const context = useContext(AdminThemeContext);
  if (!context) throw new Error("useAdminTheme must be used inside AdminThemeProvider");
  return context;
}
