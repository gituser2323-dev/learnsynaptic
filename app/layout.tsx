import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WhatsAppButton } from '@/components/ui/WhatsAppButton';
import { CustomCursor } from '@/components/ui/CustomCursor'
import { SpotlightGlow } from '@/components/ui/SpotlightGlow'
import { LeadCapturePopup } from '@/components/LeadCapturePopup';
import { LeadModalProvider } from "@/components/lead-modal";


const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});


export const metadata: Metadata = {
  title: {
    default: 'LearnSynaptic — AI & Tech Training for India',
    template: '%s | LearnSynaptic',
  },
  description:
    'LearnSynaptic offers industry-aligned AI, Full Stack, Data Science, and GenAI training programs for students and professionals across India. Based in Pune.',
  keywords: [
    'AI course India',
    'full stack developer course',
    'data science course Pune',
    'GenAI training',
    'tech bootcamp India',
    'LearnSynaptic',
  ],
  openGraph: {
    siteName: 'LearnSynaptic',
    locale: 'en_IN',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col" style={{ color: 'var(--ls-text)' }}>
                  <LeadModalProvider>

        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsAppButton />
        <SpotlightGlow />
        <CustomCursor />
        <LeadCapturePopup />


        </LeadModalProvider>
      </body>
    </html>
  );
}
