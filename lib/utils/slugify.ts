import { randomUUID } from "crypto";

/**
 * Shared slug-generation helper. Originally a private function inside
 * onboardingService.ts (Organization.slug generation); extracted here so
 * Lead Capture Forms (publicSlug) can reuse the exact same normalization
 * and collision-suffix behavior instead of a second, drifting copy.
 */
export function slugify(name: string, fallback = "item"): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || fallback;
}

export function randomSlugSuffix(): string {
  return randomUUID().slice(0, 6);
}
