import { getBrandConfigurationRepository } from "@/lib/db";
import { entitlementService } from "@/lib/services/billing";
import { fileStorageService } from "@/lib/services/storage";
import { deriveAccentShades, isValidHexColor } from "./contrast";
import { DEFAULT_BRANDING } from "./types";
import type { ResolvedBranding } from "./types";

/**
 * Business OS Phase 8, Module 8.4 — the ONE place a `BrandConfiguration`
 * row becomes the render-ready `ResolvedBranding` shape every consumer
 * (admin shell, outbound email footer) actually uses. Centralizes two
 * real decisions so no consumer ever re-implements them: (1) is this
 * organization even ENTITLED to white-label at all (`entitlementService
 * .hasCapability(orgId, "white_label")` — never a hardcoded plan-name
 * check, per the mission's own explicit instruction), and (2) does a
 * configuration actually exist. Either "no" collapses to
 * `DEFAULT_BRANDING` — the current, unmodified LearnSynaptic
 * experience, never a broken or half-applied custom theme.
 *
 * **CSS variables are deliberately narrow — never the entire design
 * system.** Only `--adm-accent`/`--adm-accent-hover`/`--adm-accent-soft`/
 * `--adm-accent-2` are ever overridden; text/surface/border/background
 * tokens stay exactly as globals.css defines them regardless of what a
 * tenant picks, which is what makes the mission's own "tenant branding
 * must NOT destroy usability" guarantee true by construction — a
 * tenant can only ever pick a button/accent color (contrast-validated
 * before it's even saved, see contrast.ts), never a text-on-background
 * combination that could become unreadable. This is a small,
 * server-computed key-value map applied as inline CSS custom
 * properties at render time — never a second, separate CSS bundle
 * generated per tenant, per the mission's own explicit instruction.
 */

interface CacheEntry {
  value: ResolvedBranding;
  expiresAt: number;
}

/** Keyed by organizationId — the mission's own explicit "cache keys
 *  MUST include tenant identity" requirement, satisfied structurally
 *  (there is no code path that could read one org's cache entry for
 *  another's request). A short TTL (not "forever") bounds staleness
 *  between an update and the next natural cache expiry, on top of the
 *  explicit `invalidate()` call `brandingService` already issues on
 *  every write — belt and suspenders, not a substitute for real
 *  invalidation. */
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

export function invalidateBrandingCache(organizationId: string): void {
  cache.delete(organizationId);
}

async function resolveAssetUrl(fileId: string | undefined): Promise<string | null> {
  if (!fileId) return null;
  const file = await fileStorageService.getFile(fileId);
  if (!file || file.deletedAt) return null;
  return fileStorageService.getDownloadUrl(fileId, 3600);
}

export async function resolveBranding(organizationId: string): Promise<ResolvedBranding> {
  const cached = cache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const resolved = await computeBranding(organizationId);
  cache.set(organizationId, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
  return resolved;
}

async function computeBranding(organizationId: string): Promise<ResolvedBranding> {
  const entitled = await entitlementService.hasCapability(organizationId, "white_label");
  if (!entitled) return DEFAULT_BRANDING;

  const repo = await getBrandConfigurationRepository();
  const config = await repo.findByOrganizationId(organizationId);
  if (!config) return DEFAULT_BRANDING;

  const [logoUrl, compactLogoUrl, faviconUrl] = await Promise.all([
    resolveAssetUrl(config.logoFileId),
    resolveAssetUrl(config.compactLogoFileId),
    resolveAssetUrl(config.faviconFileId),
  ]);

  const cssVariables: Record<string, string> = {};
  if (config.accentColor && isValidHexColor(config.accentColor)) {
    const shades = deriveAccentShades(config.accentColor);
    cssVariables["--adm-accent"] = config.accentColor;
    cssVariables["--adm-accent-hover"] = shades.hover;
    cssVariables["--adm-accent-soft"] = shades.soft;
  }
  if (config.primaryColor && isValidHexColor(config.primaryColor)) {
    cssVariables["--adm-accent-2"] = config.primaryColor;
  }

  // Every field this module lets a tenant configure counts as "custom"
  // — not just the visually obvious ones (logo/colors). A config that
  // sets ONLY, say, `footerText` (no logo, no color, no display name)
  // is real customization too, and `isCustom` is the one flag every
  // consumer (the admin shell's CSS override, the outbound-email
  // footer) gates its own behavior on — missing a field here silently
  // breaks that consumer's own real feature, exactly the bug this
  // module's own email-branding test caught before it shipped.
  const hasAnyCustomization = !!(
    config.displayName ||
    logoUrl ||
    compactLogoUrl ||
    faviconUrl ||
    Object.keys(cssVariables).length > 0 ||
    config.supportEmail ||
    config.supportUrl ||
    config.websiteUrl ||
    config.footerText
  );

  return {
    isCustom: hasAnyCustomization,
    displayName: config.displayName ?? DEFAULT_BRANDING.displayName,
    logoUrl,
    compactLogoUrl,
    faviconUrl,
    cssVariables,
    supportEmail: config.supportEmail ?? null,
    supportUrl: config.supportUrl ?? null,
    websiteUrl: config.websiteUrl ?? null,
    footerText: config.footerText ?? null,
  };
}
