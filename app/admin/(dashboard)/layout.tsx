"use client";

import { AdminAuthProvider } from "@/components/admin/AdminAuthContext";
import { AdminThemeProvider, useAdminTheme } from "@/components/admin/AdminThemeContext";
import { AdminShellStateProvider } from "@/components/admin/AdminShellState";
import { AdminBrandingProvider, useAdminBranding } from "@/components/admin/AdminBrandingContext";
import { Sidebar, MobileSidebar } from "@/components/admin/Sidebar";
import { DashboardHeader } from "@/components/admin/DashboardHeader";

/** Reads the theme context to stamp `data-theme` on the shell root —
 *  the single DOM attribute every dark/light token override in
 *  globals.css keys off (see `.admin-shell[data-theme="light"]`) —
 *  and, Business OS Phase 8 Module 8.4, the resolved branding's own
 *  `cssVariables` as an inline `style` object on the SAME root: React
 *  merges these with the class-based tokens automatically (an inline
 *  style always wins over a stylesheet rule for the same property),
 *  and an empty `cssVariables` object (the default, unbranded case)
 *  means this spreads nothing — zero visual change from before this
 *  module existed. Never a second stylesheet, never per-tenant CSS
 *  files — see `themeResolver.ts`'s own doc comment. */
function ThemedShell({ children }: { children: React.ReactNode }) {
  const { theme } = useAdminTheme();
  const { branding } = useAdminBranding();

  return (
    <div className="admin-shell flex min-h-screen" data-theme={theme} style={branding.cssVariables as React.CSSProperties}>
      <Sidebar />
      <MobileSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader />
        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * The (dashboard) route group — organizational only, doesn't appear in
 * the URL (/admin still resolves to this layout's page.tsx). Kept
 * separate from /admin/login so the sidebar/header shell and
 * AdminAuthProvider only ever wrap the pages that actually need "who's
 * logged in," not the page that establishes it.
 */
export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminBrandingProvider>
        <AdminThemeProvider>
          <AdminShellStateProvider>
            <ThemedShell>{children}</ThemedShell>
          </AdminShellStateProvider>
        </AdminThemeProvider>
      </AdminBrandingProvider>
    </AdminAuthProvider>
  );
}
