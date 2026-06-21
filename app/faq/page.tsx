import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';
import { FAQAccordion } from '@/components/FAQAccordion';

export const metadata: Metadata = {
  title: 'FAQ — Frequently Asked Questions · LearnSynaptic',
  description:
    'Common questions about LearnSynaptic programs, pricing, batch structure, refund policy, and what placement support actually includes — answered honestly.',
  openGraph: {
    title: 'FAQ — LearnSynaptic',
    description:
      'Answers to the most common questions about our AI, Full Stack Dev, and Data Science programs. Programs, Pricing, and Placement — all covered.',
  },
};

export default function FAQPage() {
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
              <HelpCircle size={12} />
              Common questions, honest answers
            </span>
            <h1 className="mb-5" style={{ maxWidth: 720 }}>
              Frequently Asked Questions
            </h1>
            <p
              className="text-lg"
              style={{ color: 'var(--ls-muted)', maxWidth: 560, lineHeight: 1.7 }}
            >
              If you don&apos;t find what you need here, reach out — we&apos;d rather answer a
              specific question than have you guess your way into the wrong program.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── FAQ Accordion ───────────────────────────────────────────────── */}
      <section style={{ padding: '56px 0 80px' }}>
        <div className="ls-container">
          <FAQAccordion />
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-bg-alt)', padding: '64px 0' }}>
        <div className="ls-container">
          <AnimateOnScroll>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div>
                <h2
                  className="mb-2"
                  style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', letterSpacing: '-0.01em' }}
                >
                  Still have questions?
                </h2>
                <p style={{ color: 'var(--ls-muted)', maxWidth: 440, lineHeight: 1.7 }}>
                  Book a free 30-minute counselling call. We&apos;ll talk through your background,
                  which program fits, and what to realistically expect from placement support.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <Link href="/contact" className="ls-btn-primary">
                  Talk to a Counsellor
                  <ArrowRight size={15} />
                </Link>
                <Link href="/programs" className="ls-btn-outline">
                  Explore Programs
                </Link>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
