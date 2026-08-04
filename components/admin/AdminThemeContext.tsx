"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AdminTheme = "dark" | "light";

const STORAGE_KEY = "ls-admin-theme";

interface AdminThemeContextValue {
  theme: AdminTheme;
  toggleTheme: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue | undefined>(undefined);

/**
 * Dark-first by design (see the redesign brief) — falls back to dark
 * whenever nothing's been saved yet, rather than reading the OS
 * preference, so a fresh admin session always opens in the intended
 * default look. Scoped to a `data-theme` attribute on .admin-shell only
 * (see globals.css) — never touches `<html>`, so it can't leak into the
 * public site's own light-only design system.
 */
export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AdminTheme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<AdminThemeContextValue>(
    () => ({
      theme,
      toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
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
