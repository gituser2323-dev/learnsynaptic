/**
 * Business OS Phase 8, Module 8.4 — White Label & Branding. One
 * `BrandConfiguration` row per organization: display identity + a
 * SMALL, deliberately bounded set of theme tokens (never the entire
 * design system — see `themeResolver.ts`'s own doc comment on why only
 * accent colors are ever overridable). Reuses Module 6.2's File
 * Storage directly for logo/favicon assets (`ORGANIZATION_ASSET`
 * category, already existed before this module) — this collection
 * only stores the resulting `FileAsset` ids, never a raw upload path
 * of its own.
 */

export interface BrandConfiguration {
  id: string;
  organizationId: string;
  /** Falls back to the real `Organization.name` when unset — this
   *  field exists only for a tenant that wants a DIFFERENT public-
   *  facing display name than its internal org record. */
  displayName?: string;
  logoFileId?: string;
  compactLogoFileId?: string;
  faviconFileId?: string;
  /** 6-digit hex, e.g. `"#6366f1"` — validated against a real WCAG
   *  contrast check before it's ever accepted, see `contrast.ts`. */
  primaryColor?: string;
  accentColor?: string;
  supportEmail?: string;
  supportUrl?: string;
  websiteUrl?: string;
  footerText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBrandConfigurationInput {
  displayName?: string;
  logoFileId?: string | null;
  compactLogoFileId?: string | null;
  faviconFileId?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  supportEmail?: string | null;
  supportUrl?: string | null;
  websiteUrl?: string | null;
  footerText?: string | null;
}

export interface BrandConfigurationRepository {
  findByOrganizationId(organizationId: string): Promise<BrandConfiguration | null>;
  upsert(organizationId: string, input: UpsertBrandConfigurationInput): Promise<BrandConfiguration>;
  /** Full reset — deletes the row entirely, distinct from an upsert
   *  with all-null fields, so "Reset to default" in the admin UI leaves
   *  no residue and a re-read is indistinguishable from "never
   *  configured." */
  deleteByOrganizationId(organizationId: string): Promise<void>;
}

/**
 * The resolved, RENDER-READY shape every consumer (admin shell,
 * outbound email footer, a future login page) actually uses — never
 * the raw `BrandConfiguration` row directly, so "is this org even
 * entitled to white-label" is decided exactly once, here, not
 * re-checked ad hoc at every call site. `isCustom: false` means
 * "render the default LearnSynaptic experience," the safe fallback for
 * every one of: no subscription capability, no configuration saved
 * yet, or a configuration that exists but references since-deleted
 * assets.
 */
export interface ResolvedBranding {
  isCustom: boolean;
  displayName: string;
  logoUrl: string | null;
  compactLogoUrl: string | null;
  faviconUrl: string | null;
  /** CSS custom-property overrides — ONLY ever `--adm-accent`/
   *  `--adm-accent-hover`/`--adm-accent-soft`/`--adm-accent-2`, see
   *  `themeResolver.ts`. Empty object when `isCustom` is false. */
  cssVariables: Record<string, string>;
  supportEmail: string | null;
  supportUrl: string | null;
  websiteUrl: string | null;
  footerText: string | null;
}

export const DEFAULT_BRANDING: ResolvedBranding = {
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
