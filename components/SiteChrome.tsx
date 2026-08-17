'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WhatsAppButton } from '@/components/ui/WhatsAppButton';
import { CustomCursor } from '@/components/ui/CustomCursor';
import { SpotlightGlow } from '@/components/ui/SpotlightGlow';
import { LeadCapturePopup } from '@/components/LeadCapturePopup';

/**
 * /bootcamp, /ai-bootcamp, /ai-generalist and /ai-full-stack-engineering
 * (a clone of /ai-bootcamp's design system for a different audience) are
 * standalone campaign microsites, not pages inside the main site — they
 * must not inherit the global Navbar/Footer/WhatsApp bubble/lead popup.
 * /ai-bootcamp, /ai-generalist and /ai-full-stack-engineering additionally
 * ship their own, completely separate design systems (an imported Claude
 * Design) so they also skip the ambient cursor glow / custom cursor
 * micro-interactions that belong to the existing site's visual identity,
 * keeping the designs from ever blending.
 *
 * /admin (Module 11 — CRM Dashboard UI) is a third category: not a
 * marketing microsite at all, an internal tool with its own shell
 * (app/admin/(dashboard)/layout.tsx — sidebar, header, no Navbar/Footer/
 * WhatsApp bubble/lead popup/cursor effects). It renders bare children
 * here; its own layout provides `id="main-content"` for the skip link
 * instead of this component doing it.
 *
 * /book (Appointment Booking's own hosted public page,
 * app/book/[slug]/page.tsx) is a fourth category, the same reasoning as
 * /admin applies to for a different reason: a real customer mid-booking
 * must never have the page's own submit button fought over by an
 * UNRELATED competing lead-capture popup — confirmed live in this
 * module's own E2E suite, where LeadCapturePopup's overlay genuinely
 * intercepted the real "Book appointment" button's click. Bare
 * treatment, matching the "hosted page, not a marketing page" intent
 * the approved plan already established for this route.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminDashboard = pathname?.startsWith('/admin');
  const isBookingPage = pathname?.startsWith('/book');
  const isAiBootcamp =
    pathname?.startsWith('/ai-bootcamp') ||
    pathname?.startsWith('/ai-generalist') ||
    pathname?.startsWith('/ai-full-stack-engineering') ||
    pathname?.startsWith('/data-analytics-bi') ||
    pathname?.startsWith('/genai');
  const isIsolatedMicrosite = pathname?.startsWith('/bootcamp') || isAiBootcamp;

  if (isAdminDashboard || isBookingPage) {
    return <>{children}</>;
  }

  if (isAiBootcamp) {
    return <main id="main-content" className="flex-1">{children}</main>;
  }

  if (isIsolatedMicrosite) {
    return (
      <>
        <main id="main-content" className="flex-1">{children}</main>
        <SpotlightGlow />
        <CustomCursor />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
      <SpotlightGlow />
      <CustomCursor />
      <LeadCapturePopup />
    </>
  );
}
