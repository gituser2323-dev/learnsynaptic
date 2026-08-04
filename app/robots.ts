import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

/**
 * SEO (Module 10 performance audit) — no robots.txt existed before
 * this. Next.js's file convention serves this at /robots.txt
 * automatically. Disallowing /api/ keeps crawlers off routes that were
 * never page content in the first place — including /api/admin/* and
 * /api/auth/*, which already reject unauthenticated requests (Module 9)
 * but shouldn't be spending crawl budget regardless.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
