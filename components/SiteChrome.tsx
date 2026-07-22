'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WhatsAppButton } from '@/components/ui/WhatsAppButton';
import { CustomCursor } from '@/components/ui/CustomCursor';
import { SpotlightGlow } from '@/components/ui/SpotlightGlow';
import { LeadCapturePopup } from '@/components/LeadCapturePopup';

/**
 * /bootcamp and /ai-bootcamp are standalone campaign microsites, not pages
 * inside the main site — they must not inherit the global Navbar/Footer/
 * WhatsApp bubble/lead popup. /ai-bootcamp additionally ships its own,
 * completely separate design system (an imported Claude Design) so it also
 * skips the ambient cursor glow / custom cursor micro-interactions that
 * belong to the existing site's visual identity, keeping the two designs
 * from ever blending.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAiBootcamp = pathname?.startsWith('/ai-bootcamp');
  const isIsolatedMicrosite = pathname?.startsWith('/bootcamp') || isAiBootcamp;

  if (isAiBootcamp) {
    return <main className="flex-1">{children}</main>;
  }

  if (isIsolatedMicrosite) {
    return (
      <>
        <main className="flex-1">{children}</main>
        <SpotlightGlow />
        <CustomCursor />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
      <SpotlightGlow />
      <CustomCursor />
      <LeadCapturePopup />
    </>
  );
}
