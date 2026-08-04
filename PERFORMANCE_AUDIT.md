# Performance Optimization — Audit (Module 10)

**Status: Audited and implemented.** See `CHANGELOG.md`'s "Performance
Optimization" entry for the full file list and live verification. This
document is the audit itself — findings across all 11 requested
categories, what was fixed, and what was deliberately left alone (with
reasoning), so a "no action" conclusion is never confused with an
oversight.

Measured with a real Lighthouse run (`npx lighthouse`, headless Chrome,
against a real `next build && next start` server — not simulated)
against the homepage, before and after this module's changes:

| Category | Before | After |
|---|---|---|
| Performance | 78 | 82 |
| Accessibility | 94 | 96 |
| Best Practices | 96 | 96 |
| SEO | 100 | 100 |

---

## 1. Bundle Size

**Finding: two fully unused dependencies, ~14 MB of `node_modules`.**
`gsap` and `@splinetool/react-spline` + `@splinetool/runtime` had zero
imports anywhere in `app/` or `components/` — verified with a
whole-repo regex search, not just a directory listing (ruled out a false
positive: a "spline" match inside a shipped chunk turned out to be
`keySplines`, an unrelated SVG attribute name). `@splinetool` was
referenced by exactly one file, `components/ui/spline-scene.tsx` — a
wrapper with a `// TODO: Replace with custom LearnSynaptic Spline
scene` comment — which was itself never imported by anything.

Confirmed via `.next/static/chunks` inspection that neither package was
already being tree-shaken out of shipped JS (they weren't reachable at
all, so they never shipped) — meaning this fix doesn't change bundle
*weight on the wire*, only install size, audit surface, and the
confusion of a dead component sitting in the tree. `node_modules`:
545 MB → 531 MB.

**Action:** removed both packages and the dead wrapper file.

## 2. Image Optimization

**Finding: already strong.** Zero raw `<img>` tags render anything
broken by omission — 21 of the site's images already go through
`next/image`, all with real `alt` text (verified with an AST-ish regex
pass, not a substring grep, after an initial false-negative check on
`<img` — see note below). `next.config.ts` had no explicit image
`formats` configured (Next defaults still serve modern formats, but not
explicitly AVIF-first).

**Note on method:** a first-pass `grep "<img "` (trailing space) missed
every multi-line `<img\n  src=...` tag — a real blind spot in naive
grep-based auditing. A second pass without that assumption found 4 raw
`<img>` tags, all deliberate: two use dynamic, per-item `posterSrc`
values with an `onError` fallback handler (`VideoTestimonialsSection.tsx`,
`HomepageVideoTeaser.tsx`) that `next/image` doesn't fit as cleanly, and
one renders a marquee of ~14 SVG tech logos (`HeroSection.tsx`) — SVGs
require `images.dangerouslyAllowSVG` before `next/image` will even
serve them (a security-relevant opt-in, since SVG can carry scripts),
so converting these without that config change would break a
currently-working marquee for a format that gets little compression
benefit from the optimizer anyway. Left as-is.

**Action:** `next.config.ts` now sets `images.formats:
["image/avif", "image/webp"]` explicitly.

## 3. Code Splitting / 4. Dynamic Imports

**Finding: the two lead-capture modals were bundled into every single
page.** `LeadModalProvider` (mounted once in the root layout — i.e.
every page on the main site) statically imported `LeadModal`, which
pulls in `LeadForm`, `SuccessScreen`, and framer-motion's
`AnimatePresence` — all shipped even though the modal is invisible until
a user clicks a trigger. The ai-bootcamp and ai-generalist landing pages
had the identical pattern with `RegistrationModal`/`SuccessModal`.

**Action:** all three now load via `next/dynamic`.
`LeadModalProvider.tsx` is a Client Component, so it uses `{ ssr: false
}` (the modal starts closed and renders nothing server-side regardless
— zero hydration-mismatch risk). The two `LandingPage.tsx` files are
Server Components, where `next/dynamic`'s `ssr: false` is disallowed by
Next.js — they use plain `dynamic()` with a `.then()` unwrap for the
named exports, which still code-splits and stays SSR-compatible.
Verified post-build: the string `"Reserve My Free Demo"` (unique to
`LeadForm`) now lives in its own chunk file, not a page's main chunk.

## 5. Caching

**Finding: `GET /api/campaigns` (public, read-mostly) had no
Cache-Control.** Everything else cacheable is either already static
(marketing pages) or intentionally never-cached (every `/api/admin/*`
and `/api/auth/*` route is auth-gated, per-request business/security
data that must never be shared across requests). `/_next/static/*`
already gets Next's own immutable, 1-year cache automatically — adding
a duplicate header would be redundant. `/public` assets (logos, gallery
photos) get no framework-default caching at all, since they aren't
content-hashed.

**Action:** `apiSuccess()` (`lib/api/response.ts`) gained an optional
third `headers` parameter — mirroring `apiError()`, which already had
one — so any route can opt into custom headers without a new
convention. `GET /api/campaigns` now sends `Cache-Control: public,
max-age=30, stale-while-revalidate=120` (short enough that a
just-activated campaign is never meaningfully stale). `next.config.ts`
adds a `Cache-Control: public, max-age=86400,
stale-while-revalidate=604800` header for `/public` image assets — a
day, not Next's own 1-year/immutable policy, since these files aren't
fingerprinted and a real content update shouldn't require a cache-bust
workaround.

## 6. ISR

**Finding: not applicable to any page today.** Every page is either
fully static marketing content or an auth-gated dynamic API route. Blog
posts (`app/blog/[slug]/page.tsx`, `generateStaticParams()`) are
sourced from `lib/blog-posts.ts` — a source-controlled TypeScript array,
not a CMS or database — so there is no external data that could change
*without* a redeploy for `revalidate` to usefully re-check. Adding
`export const revalidate = N` here would be cosmetic: identical content
re-rendered on a timer for no reason. **Trigger for revisiting:** if
blog content ever moves to a CMS/database instead of the in-repo array,
add `revalidate` at that point — the architecture doesn't need to
change, just this one export.

## 7. Metadata

**Findings and actions:**
- Every page already had `metadata`/`generateMetadata` — confirmed
  across all 14 top-level routes plus `blog/[slug]` before touching
  anything.
- **No `metadataBase`** — Next.js resolves relative OG/Twitter image
  URLs against an inferred origin without it, and warns at build time
  when they're used. Added: `metadataBase: new URL(SITE_URL)` in the
  root layout, backed by a new single source of truth,
  `config/site.ts`, replacing a URL that was previously hardcoded
  independently in `app/bootcamp/page.tsx`'s JSON-LD.
- **No `openGraph.images` or `twitter` card** anywhere. Added both to
  the root layout's default metadata, using the existing
  `public/logo2.png` (1920×1080, a real brand asset) as the
  fallback social-share image. This is explicitly *not* a
  purpose-built 1200×630 OG card with a tagline — it's the best
  available existing asset, better than the previous "nothing," and a
  real designed card is a reasonable future upgrade.
- **No `robots` field** — added an explicit `{ index: true, follow:
  true }` (matches the previous implicit default; now stated, not
  assumed).
- **Structured data existed on exactly one page** (`app/bootcamp/page.tsx`'s
  `Course` schema). Added a site-wide `EducationalOrganization` JSON-LD
  to the root layout — same plain-`<script>` convention, no new library.

## 8. Fonts

**Finding: already optimal, no action taken.** `next/font/google`
(Inter) with `display: "swap"` was already in place before this module
— self-hosted (no external Google Fonts request, no render-blocking
`<link>`), and `swap` avoids invisible text during load. Nothing to fix.

## 9. Lighthouse

Run for real (see the scores table at the top) via `npx lighthouse`
against a genuine `next build && next start` server, using the
machine's actual Chrome install (`--chrome-path`), not a simulated or
estimated score. Every fix in §10/§11 below was verified by re-running
Lighthouse after the change and confirming the specific flagged node
was gone — not assumed fixed.

## 10. Accessibility

**Fixed, all traced to a specific Lighthouse-flagged DOM node or a
targeted follow-up search, not a blanket pass:**
- **Missing form labels.** `LeadForm.tsx` (the site's highest-traffic
  lead-capture form — triggered from the Navbar, WhatsApp button, and
  throughout the site) and both `RegistrationModal.tsx` files relied on
  `placeholder` alone for every input's accessible name — a WCAG 4.1.2
  failure (placeholder text disappears once typed, and isn't reliably
  announced as a label). `RegisterForm.tsx`, `ContactForm.tsx`, and
  `InternshipApplyForm.tsx` already used proper `<label htmlFor>` —
  this gap was isolated to these three files. Fixed with `aria-label`
  (the narrowest correct fix: zero visual change, unlike adding visible
  `<label>` elements would risk).
- **No skip-to-content link anywhere** (WCAG 2.4.1). Added one in the
  root layout — visually hidden until keyboard-focused
  (`sr-only focus:not-sr-only`), so it's invisible to mouse/touch users
  in normal browsing.
- **Insufficient color contrast**, two specific instances Lighthouse
  flagged on the homepage:
  - `text-slate-400` (#90a1b9, 2.63:1 against white — needs 4.5:1) on
    the "trusted by" company-name marquee (`LogoMarquee.tsx`). Fixed:
    `text-slate-500` (#64748b, 4.76:1 — computed via the actual WCAG
    relative-luminance formula, not guessed, so it's a comfortable
    pass, not another razor-thin one). Scoped to this one component,
    not a sitewide find-replace of the utility class.
  - `var(--ls-muted)` (#71717a on #eff6ff, 4.44:1 — needs 4.5:1) in the
    footer. **Not fixed** — `--ls-muted` is a global design token used
    across dozens of files; changing its value site-wide is a
    materially bigger, more visible decision than a single component's
    utility class, and the miss is marginal (0.06 short). Flagged for
    the user to decide with full context rather than changed
    unilaterally under a "do not redesign UI" instruction.
- **Heading order** — two Lighthouse-flagged nodes
  (`TestimonialCard.tsx`'s author name, `Footer.tsx`'s three column
  titles) used `<h4>` directly under an `<h2>` section heading, skipping
  `<h3>`. Fixed by changing the tag only (identical CSS classes, zero
  visual change) — also applied the same fix to `TestimonialCard2.tsx`
  (unused by any current page, but consistent). Re-running Lighthouse
  after this fix still showed the *same* violation, which led to the
  real root cause: **`app/page.tsx` had two `<h1>` elements** — the
  correct one in `HeroSection.tsx`, and a second, larger one in the
  page's closing CTA section. `h1 → h3` (skipping `h2`) was still
  invalid even after the `h4 → h3` fix. Changed the second `<h1>` to
  `<h2>` (again, identical classes — same size, same visual weight,
  still the largest heading on the page). Verified: ai-bootcamp,
  ai-generalist, and `/bootcamp` do *not* share this bug — each has
  exactly one real `<h1>`, including `/bootcamp`'s, which is rendered
  through a polymorphic `RevealHeadline` component (`as="h1"`) that a
  naive `grep "<h1"` can't see through, and was checked directly in its
  source rather than assumed broken.
- **Not fixed — flagged only:** Lighthouse's "browser errors logged to
  console" audit caught 7 real `404`s on the homepage:
  `/students/1.jpg` through `/students/5.jpg`, `/student.jpg`, and
  `/videos/testimonial.mp4` — referenced by `HeroSection.tsx`'s student-
  avatar stack and testimonial video, none of which exist in `public/`.
  This predates this module. No responsible fix was available within
  "do not redesign UI": there's no real photo/video content to point
  these at, fabricating placeholder imagery would be its own integrity
  problem, and removing the avatar stack or video player outright is a
  visible structural change, not a markup/semantic correction like
  every other fix in this section. Left for a real content decision.

## 11. SEO

**Findings and actions:**
- **No `robots.txt` or `sitemap.xml` existed anywhere.** Added
  `app/robots.ts` (allows everything except `/api/*`, references the
  sitemap) and `app/sitemap.ts` (every static marketing route,
  hand-listed rather than filesystem-scanned so a future non-page file
  can't accidentally leak in, plus every blog post generated from the
  same `lib/blog-posts.ts` data `generateStaticParams()` already uses —
  a new post appears in both automatically). Both use Next's file-
  convention (served at `/robots.txt` and `/sitemap.xml` with no route
  handler needed) — confirmed present in the build output.
- **Structured data, metadataBase, and the OG/Twitter gaps** are
  covered under §7 (Metadata) — SEO and Metadata overlap heavily by
  nature; not repeated here.
- Homepage Lighthouse SEO score was already 100 before this module
  (existing per-page metadata was already solid) — the additions above
  matter site-wide and for crawlers/social platforms specifically, not
  for this one score.

---

## Method notes (for whoever picks this up next)

- Every "already good" conclusion in this document was verified by
  reading the actual file or running the actual tool — not inferred
  from the category name. Where a first-pass check had a blind spot
  (the `<img>` grep, the "one h1" file-level count that missed a
  component-tree duplicate), the blind spot is documented, not silently
  corrected without a trace.
- Contrast fixes used the real WCAG relative-luminance formula on the
  actual hex values Lighthouse reported, not a guessed replacement
  shade.
- Every fix here was re-verified with a second Lighthouse run
  confirming the specific flagged node was gone, except the two
  deliberately-left-alone findings (broken placeholder assets, the
  global `--ls-muted` token), which are still present and expected to
  be.
