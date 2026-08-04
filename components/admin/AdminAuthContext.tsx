"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout as apiLogout, type DashboardUser } from "./apiClient";

interface AdminAuthContextValue {
  user: DashboardUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

/**
 * Scoped to app/admin/(dashboard)/layout.tsx only — /admin/login has no
 * need for "who's currently logged in" and manages its own local form
 * state independently (see app/admin/login/page.tsx).
 *
 * middleware.ts already guarantees nothing reaches this component
 * without a valid session (it redirects unauthenticated page requests
 * to /admin/login before any dashboard page renders), so the getMe()
 * call here is for two things, not for gating access: (1) the actual
 * identity/role to show in the header and to explain a 403 elsewhere in
 * the dashboard, and (2) apiClient.ts's own refresh-on-401 handling
 * covers the case where the access token expires *while* the user is
 * already on a dashboard page — this mount-time call doesn't duplicate
 * that, it's just the first read.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    getMe().then((result) => {
      if (cancelled) return;
      setUser(result.success ? result.data.user : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    router.replace("/admin/login");
  }, [router]);

  return <AdminAuthContext.Provider value={{ user, loading, logout }}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  }
  return context;
}
