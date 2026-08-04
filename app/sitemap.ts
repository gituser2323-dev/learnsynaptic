import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blog-posts";
import { SITE_URL } from "@/config/site";

/**
 * SEO (Module 10 performance audit) — no sitemap existed anywhere in
 * this codebase before this. Next.js's file convention: this default
 * export is served at /sitemap.xml automatically, no route handler
 * needed. Static routes are hand-listed (this site's page count is
 * small and stable enough that enumerating them is more honest than a
 * filesystem-scanning generator would be — e.g. it can't accidentally
 * include a future non-page file); blog posts are generated from the
 * same lib/blog-posts.ts data app/blog/[slug]/page.tsx's
 * generateStaticParams() already uses, so a new post appears in both
 * automatically.
 */

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

const STATIC_ROUTES: { path: string; changeFrequency: ChangeFrequency; priority: number }[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/programs", changeFrequency: "monthly", priority: 0.8 },
  { path: "/programs/bootcamp", changeFrequency: "monthly", priority: 0.8 },
  { path: "/programs/data-science", changeFrequency: "monthly", priority: 0.8 },
  { path: "/programs/full-stack-devops", changeFrequency: "monthly", priority: 0.8 },
  { path: "/programs/genai-builder", changeFrequency: "monthly", priority: 0.8 },
  { path: "/bootcamp", changeFrequency: "weekly", priority: 0.9 },
  { path: "/ai-bootcamp", changeFrequency: "weekly", priority: 0.9 },
  { path: "/ai-generalist", changeFrequency: "weekly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.7 },
  { path: "/placements", changeFrequency: "monthly", priority: 0.6 },
  { path: "/testimonials", changeFrequency: "monthly", priority: 0.5 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  { path: "/internship", changeFrequency: "monthly", priority: 0.6 },
  { path: "/register", changeFrequency: "monthly", priority: 0.5 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((post) => {
    const parsed = new Date(post.publishDate);
    return {
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: Number.isNaN(parsed.getTime()) ? undefined : parsed,
      changeFrequency: "monthly",
      priority: 0.6,
    };
  });

  return [...staticEntries, ...blogEntries];
}
