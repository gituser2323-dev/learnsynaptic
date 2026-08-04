import type { NextConfig } from "next";

/**
 * RC-1 stabilization — this app previously shipped zero security response
 * headers. This CSP is intentionally not the strictest possible policy:
 * GA4 and Meta Pixel (components/analytics/AnalyticsScripts.tsx) are
 * bootstrapped via inline <Script> blocks with embedded JS, not
 * external-src-only tags, so script-src needs 'unsafe-inline' unless a
 * nonce is threaded through middleware.ts into every page render — a
 * real, larger change this stabilization pass isn't risking without the
 * ability to live-verify every page afterward. Every other directive is
 * scoped to the actual domains this app talks to (verified by grepping
 * every external URL referenced in the codebase), not left wide open.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com https://www.facebook.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://graph.facebook.com https://api.emailjs.com",
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/**
 * RC-2 Enterprise Security Hardening — every one of these APIs was
 * grepped for a real caller across app/ and components/ first
 * (`navigator.clipboard`/`requestFullscreen`/`autoplay`/etc.); only
 * `clipboard-write` has one (Security Settings' own "copy recovery
 * codes" button — see app/admin/(dashboard)/settings/security/page.tsx),
 * so it's the one entry allowed for `self`. Every other directive here
 * denies a capability this app genuinely never uses, closing off real
 * attack surface (a compromised third-party script — GA4/Meta Pixel's
 * own tags are the only ones this app loads at all — gains nothing
 * from these APIs even if it tried) rather than leaving the browser
 * default (usually far more permissive) in place by omission.
 */
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "clipboard-write=(self)",
  "payment=()",
  "usb=()",
  "bluetooth=()",
  "midi=()",
  "magnetometer=()",
  "gyroscope=()",
  "accelerometer=()",
  "ambient-light-sensor=()",
  "autoplay=()",
  "encrypted-media=()",
  "fullscreen=(self)",
  "picture-in-picture=()",
  "screen-wake-lock=()",
  "sync-xhr=()",
  "interest-cohort=()",
].join(", ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
  // HTTPS-only in production — harmless in local dev (HTTP requests
  // simply ignore it; the browser only enforces HSTS over HTTPS).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Redundant with frame-ancestors above for modern browsers, kept for
  // the older browsers that only understand this header.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  // RC-2 — isolates this app's own top-level window from a cross-
  // origin popup's own `window.opener` access (the standard "tabnabbing"
  // mitigation), WITHOUT breaking the one real cross-origin popup flow
  // this app has: WhatsApp Embedded Signup's Facebook Login popup
  // (Module 8.5, WhatsAppEmbeddedSignupPanel) — `same-origin` (the
  // stricter variant) blocks that popup's own postMessage-based
  // handshake back to the opener; `same-origin-allow-popups` keeps it
  // working while still isolating from cross-origin popups this app
  // itself didn't open.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Blocks legacy Flash/Acrobat cross-domain policy file lookups — no
  // functional cost (this app serves neither), real defense-in-depth
  // against an old, still-occasionally-abused vector.
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // Minor privacy/metadata hardening — stops the browser from
  // speculatively resolving DNS for every link on a page ahead of a
  // click, a small but real cross-site tracking signal reduction.
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Performance audit (Module 10).
  images: {
    // AVIF first (typically smaller than WebP for the same quality),
    // WebP as the fallback for browsers that support it but not AVIF —
    // next/image negotiates via the request's Accept header. Every
    // *photo* in this app goes through this pipeline (verified: every
    // raw <img> found in a fresh V1 audit — a broken avatar row and two
    // unoptimized video-poster attributes — was converted to <Image>).
    // One deliberate exception remains: HeroSection.tsx's tech-logo
    // marquee uses raw <img> for small (~2-5KB) repeated SVG icons,
    // where next/image's resize/format pipeline has nothing to optimize
    // and would add loader overhead to an infinitely-scrolling list for
    // no benefit.
    formats: ["image/avif", "image/webp"],
  },
  // Removes the `X-Powered-By: Next.js` response header — a few bytes
  // off every response, and one less thing advertising the exact stack.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Static assets under /public (logos, gallery photos, SVGs) —
        // unlike /_next/static (Next's own fingerprinted build output,
        // already cached immutably for a year by the framework itself),
        // these are served under their literal filename with no content
        // hash, so an "immutable, 1 year" cache would risk serving stale
        // bytes after a real content update. A day is long enough to
        // meaningfully cut repeat-visit requests without that risk.
        source: "/:path*.:ext(png|jpg|jpeg|webp|avif|svg|gif|ico)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        // Every route, including API routes — the admin dashboard and
        // JSON APIs deserve the same framing/sniffing protection as the
        // marketing pages.
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
