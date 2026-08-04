import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone, MapPin, Globe, ArrowRight } from 'lucide-react';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';
import { ContactForm, CallbackForm } from '@/components/ContactForm';

export const metadata: Metadata = {
  alternates: { canonical: '/contact' },
  title: 'Contact Us — LearnSynaptic',
  description:
    'Get in touch with the LearnSynaptic team. Ask about programs, book a free counselling session, or request a callback. Pune-based, available pan-India.',
  openGraph: {
    title: 'Contact LearnSynaptic',
    description:
      'Send us a message, request a free callback, or book a 30-minute counselling session with our team.',
  },
};

/* ── Instagram SVG (lucide-react v1.21 has no social icons) ───────────── */
function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="pt-32 pb-14 lg:pt-40 lg:pb-16"
        style={{ background: 'var(--ls-hero-bg)' }}
      >
        <div className="ls-container">
          <AnimateOnScroll>
            <span className="ls-badge mb-5 inline-flex">
              <Phone size={12} />
              Pune-based · Pan-India
            </span>
            <h1 className="mb-5" style={{ maxWidth: 680 }}>
              Talk to us directly.
            </h1>
            <p
              className="text-lg"
              style={{ color: 'var(--ls-muted)', maxWidth: 520, lineHeight: 1.7 }}
            >
              Whether you have a question about a specific program, want help choosing the
              right fit, or just want to know what a batch looks like day-to-day — we&apos;re
              easy to reach.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Main section: form left, info right ─────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14 items-start">

            {/* Left — contact form (wider column) */}
            <div className="lg:col-span-3">
              <ContactForm />
            </div>

            {/* Right — contact details */}
            <div className="lg:col-span-2 space-y-6">

              {/* Info card */}
              <div
                className="rounded-2xl border p-6"
                style={{ borderColor: 'var(--ls-border)', background: '#fff' }}
              >
                <h2
                  className="mb-5"
                  style={{ fontSize: 'clamp(1.125rem, 2vw, 1.375rem)', letterSpacing: '-0.01em' }}
                >
                  Contact details
                </h2>

                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'var(--ls-blue-tint)' }}
                    >
                      <MapPin size={15} style={{ color: 'var(--ls-blue-primary)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ls-text)' }}>
                        Office
                      </p>
                      <p className="text-sm" style={{ color: 'var(--ls-muted)', lineHeight: 1.6 }}>
                        Office No. 201, Success Square<br />
                        Karve Rd, near Karve Statue<br />
                        Kothrud, Pune, Maharashtra 411038
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'var(--ls-blue-tint)' }}
                    >
                      <Phone size={15} style={{ color: 'var(--ls-blue-primary)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ls-text)' }}>
                        Phone / WhatsApp
                      </p>
                      <a
                        href="tel:+919763969449"
                        className="text-sm"
                        style={{ color: 'var(--ls-blue-primary)', fontWeight: 500 }}
                      >
                        +91 9763969449
                      </a>
                    </div>
                  </li>

                  <li className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: 'var(--ls-blue-tint)' }}
                    >
                      <Mail size={15} style={{ color: 'var(--ls-blue-primary)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ls-text)' }}>
                        Email
                      </p>
                      <a
                        href="mailto:hello@learnsynaptic.com"
                        className="text-sm"
                        style={{ color: 'var(--ls-blue-primary)', fontWeight: 500 }}
                      >
                        hello@learnsynaptic.com
                      </a>
                    </div>
                  </li>

                  {/* Socials */}
                  <li
                    className="pt-4"
                    style={{ borderTop: '1px solid var(--ls-border)' }}
                  >
                    <p className="text-sm font-semibold mb-3" style={{ color: 'var(--ls-text)' }}>
                      Follow us
                    </p>
                    <div className="flex items-center gap-4">
                      <a
                        href="https://instagram.com/learnsynaptic"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-medium"
                        style={{ color: 'var(--ls-blue-primary)' }}
                      >
                        <InstagramIcon size={16} />
                        @learnsynaptic
                      </a>
                      <a
                        href="https://pratiksabale.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-medium"
                        style={{ color: 'var(--ls-blue-primary)' }}
                      >
                        <Globe size={15} />
                        pratiksabale.com
                      </a>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Google Maps — Success Square, Karve Rd, Kothrud, Pune */}
              <div
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: 'var(--ls-border)' }}
              >
                <iframe
                  src="https://maps.google.com/maps?q=Success+Square,+Karve+Rd,+near+Karve+Statue,+Kothrud,+Pune,+Maharashtra+411038&t=m&z=16&ie=UTF8&iwloc=B&output=embed"
                  width="100%"
                  height="220"
                  style={{ border: 0, display: 'block' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="LearnSynaptic office location"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Request a Callback ──────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-bg-alt)', padding: '64px 0' }}>
        <div className="ls-container">
          <AnimateOnScroll>
            <div className="max-w-3xl">
              <span className="ls-badge mb-4 inline-flex">Free session</span>
              <h2 className="mb-2">
                Book a free 30-minute career counselling call.
              </h2>
              <p className="mb-8" style={{ color: 'var(--ls-muted)', maxWidth: 520, lineHeight: 1.7 }}>
                Not sure which program to pick? Leave your number and we&apos;ll call you
                back at a time that works — no pitch, just an honest conversation about
                where you are and what makes sense.
              </p>
              <CallbackForm />
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── CTA banner ──────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '88px 0' }}>
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <h2
              className="mb-4"
              style={{ color: '#fff', maxWidth: 600, margin: '0 auto 1rem' }}
            >
              The next cohort starts July 7. Seats are limited.
            </h2>
            <p
              className="text-lg mb-8"
              style={{
                color: 'rgba(255,255,255,0.8)',
                maxWidth: 480,
                margin: '0 auto 2rem',
                lineHeight: 1.7,
              }}
            >
              Reserve your spot now and get priority access to the batch. We&apos;ll
              confirm your seat within 24 hours of receiving your details.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/programs"
                className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 transition-transform"
                style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}
              >
                Explore Programs
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/faq"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl border-2 hover:-translate-y-0.5 transition-transform"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', fontSize: '0.9375rem' }}
              >
                Read the FAQ
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
