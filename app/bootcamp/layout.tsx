import Link from 'next/link';
import Image from 'next/image';

/**
 * Isolated campaign-microsite shell for /bootcamp. No nav links, no footer —
 * this page has exactly one goal (registration), so the only chrome is a
 * logo mark and a way back home. See components/SiteChrome.tsx for the
 * matching Navbar/Footer suppression in the root layout.
 */
export default function BootcampLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="fixed top-5 inset-x-0 z-[60] flex justify-center pointer-events-none px-5">
        <Link
          href="/"
          aria-label="LearnSynaptic — back to homepage"
          className="pointer-events-auto flex items-center rounded-2xl bg-white/95 backdrop-blur-xl px-4 py-2.5 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.45)] transition-transform duration-200 hover:scale-[1.03]"
        >
          <Image
            src="/logo-wordmark.png"
            alt="LearnSynaptic"
            height={24}
            width={74}
            priority
            style={{ height: 24, width: 74 }}
          />
        </Link>
      </header>
      {children}
    </>
  );
}
