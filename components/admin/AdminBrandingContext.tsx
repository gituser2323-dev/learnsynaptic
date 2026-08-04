"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getBranding, type ResolvedBrandingResponse } from "./apiClient";

const DEFAULT_BRANDING: ResolvedBrandingResponse = {
  isCustom: false,
  displayName: "LearnSynaptic",
  logoUrl: null,
  compactLogoUrl: null,
  faviconUrl: null,
  cssVariables: {},
  supportEmail: null,
  supportUrl: null,
  websiteUrl: null,
  footerText: null,
};

interface AdminBrandingContextValue {
  branding: ResolvedBrandingResponse;
  loading: boolean;
  refresh: () => void;
}

const AdminBrandingContext = createContext<AdminBrandingContextValue | undefined>(undefined);

/**
 * Business OS Phase 8, Module 8.4 — scoped alongside `AdminAuthProvider`
 * in `app/admin/(dashboard)/layout.tsx`, the same client-side
 * fetch-on-mount pattern that provider already established (this app's
 * admin shell has no server-side per-tenant rendering path — see
 * `middleware.ts`'s own Edge-runtime doc comment on why; a real,
 * disclosed limitation, not an oversight: the shell briefly renders
 * DEFAULT_BRANDING before this fetch resolves, the same "flash before
 * hydration" shape `AdminAuthProvider`'s own `loading` state already
 * has for identity). Starts at the safe default (unbranded, exactly
 * today's LearnSynaptic experience) so an organization with no
 * customization or no `white_label` entitlement never sees anything
 * other than the current, unmodified UI — the resolved shape from
 * `GET /api/admin/branding` already collapsed that decision server-side
 * (see `themeResolver.ts`), this component never re-derives it.
 */
export function AdminBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<ResolvedBrandingResponse>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getBranding().then((result) => {
      if (cancelled) return;
      setBranding(result.success ? result.data.branding : DEFAULT_BRANDING);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  // Business OS Phase 8, Module 8.4 — the browser tab's own title/icon,
  // the one piece of "app metadata" branding this app CAN reach: the
  // root layout's <title>/favicon are a static, build-time Metadata
  // object (no generateMetadata, no per-request rendering — see the
  // pre-build audit), so a real per-tenant override here has to be a
  // client-side DOM patch, the same reasoning `data-theme` and this
  // provider's own CSS-variable injection already accept. Only touches
  // the DOM when `isCustom` is true — an unbranded organization leaves
  // Next.js's own managed title/favicon completely untouched.
  useEffect(() => {
    if (!branding.isCustom) return;
    const previousTitle = document.title;
    document.title = `${branding.displayName} Admin`;

    let faviconLink: HTMLLinkElement | null = null;
    let previousHref: string | null = null;
    if (branding.faviconUrl) {
      faviconLink = document.querySelector('link[rel="icon"]');
      if (faviconLink) {
        previousHref = faviconLink.href;
        faviconLink.href = branding.faviconUrl;
      }
    }

    return () => {
      document.title = previousTitle;
      if (faviconLink && previousHref) faviconLink.href = previousHref;
    };
  }, [branding]);

  return (
    <AdminBrandingContext.Provider value={{ branding, loading, refresh: () => setRefreshToken((t) => t + 1) }}>{children}</AdminBrandingContext.Provider>
  );
}

export function useAdminBranding(): AdminBrandingContextValue {
  const ctx = useContext(AdminBrandingContext);
  if (!ctx) throw new Error("useAdminBranding must be used within AdminBrandingProvider");
  return ctx;
}
