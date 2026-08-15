import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { SiteChrome } from '@/components/SiteChrome';
import { LeadModalProvider } from "@/components/lead-modal";
import { AnalyticsScripts, PageViewTracker, ScrollDepthTracker } from '@/components/analytics';
import { SITE_URL } from '@/config/site';


const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});


const DEFAULT_DESCRIPTION =
  'LearnSynaptic offers industry-aligned AI, Full Stack, Data Science, and GenAI training programs for students and professionals across India. Based in Ahilyanagar.';

// metadataBase resolves every relative URL used in openGraph/twitter
// metadata (here and on every page that sets its own) into an absolute
// one. Without it, Next.js falls back to inferring the origin per-
// environment and warns at build time — this is the fix (SEO/Metadata,
// Module 10 performance audit).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'LearnSynaptic — AI & Tech Training for India',
    template: '%s | LearnSynaptic',
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    'AI course India',
    'full stack developer course',
    'data science course Ahilyanagar',
    'GenAI training',
    'tech bootcamp India',
    'LearnSynaptic',
  ],
  openGraph: {
    siteName: 'LearnSynaptic',
    locale: 'en_IN',
    type: 'website',
    // Existing brand asset used as the fallback social-share image
    // (better than none) — not a purpose-built 1200×630 OG card. See
    // CHANGELOG's Performance Optimization entry.
    images: [{ url: '/logo2.png', width: 1920, height: 1080, alt: 'LearnSynaptic' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LearnSynaptic — AI & Tech Training for India',
    description: DEFAULT_DESCRIPTION,
    images: ['/logo2.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Site-wide Organization schema (SEO, Module 10 performance audit) — the
// only structured data in this codebase before this was a page-specific
// Course schema on app/bootcamp/page.tsx; same convention (a plain
// script tag, no library), applied once at the root so every page
// carries it rather than each page redeclaring the same Organization
// facts.
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: 'LearnSynaptic',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  sameAs: [SITE_URL],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col" style={{ color: 'var(--ls-text)' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {/* Accessibility (Module 10 performance audit): invisible until
            keyboard-focused, standard WCAG 2.4.1 "Bypass Blocks" pattern —
            lets keyboard/screen-reader users skip the nav on every page
            instead of tabbing through it every time. No visual change for
            mouse/touch users. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
          style={{ color: 'var(--ls-text)' }}
        >
          Skip to main content
        </a>
        <AnalyticsScripts />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <ScrollDepthTracker />
        <LeadModalProvider>
          <SiteChrome>{children}</SiteChrome>
        </LeadModalProvider>
      </body>
    </html>
  );
}
