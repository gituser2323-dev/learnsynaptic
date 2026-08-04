import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Clock, CheckCircle2, Code2, Brain, TrendingUp, Layers, MessageCircle,
} from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';

export const metadata: Metadata = {
  alternates: { canonical: '/pricing' },
  title: 'Fees & EMI — LearnSynaptic Programs',
  description:
    'LearnSynaptic program details, features, and payment options. 0% EMI available. Book a free counselling call to discuss exact pricing for the program that fits your goals.',
  openGraph: {
    title: 'Program Fees & Features — LearnSynaptic',
    description:
      'Compare what\'s included in each LearnSynaptic program. Book a free 30-minute call to get exact fees and EMI options.',
  },
};

const programs = [
  {
    icon: Code2,
    tag: 'Most Popular',
    title: 'AI Powered Full Stack Dev + DevOps',
    slug: 'full-stack-devops',
    duration: '6 Months',
    level: 'Intermediate',
    hours: '360+',
    projects: 3,
    includes: [
      '360+ hours of live instruction',
      '3 production-grade portfolio projects',
      'AWS deployment — real infrastructure',
      'AI integration at every layer (OpenAI, LangChain)',
      '6 months placement support',
      '1-year access to recordings',
      'LearnSynaptic completion certificate',
      'Alumni Slack community',
    ],
  },
  {
    icon: Brain,
    tag: 'High Demand',
    title: 'GenAI Builder → Freelancer Program',
    slug: 'genai-builder',
    duration: '3 Months',
    level: 'Beginner–Intermediate',
    hours: '200+',
    projects: 3,
    includes: [
      '200+ hours of live instruction',
      '3 client-ready freelance projects',
      'Freelance acquisition module (Upwork + LinkedIn)',
      'LangChain, RAG, and AI agent development',
      '6 months placement & freelance support',
      '1-year access to recordings',
      'LearnSynaptic completion certificate',
      'Alumni network access',
    ],
  },
  {
    icon: TrendingUp,
    tag: 'Career Booster',
    title: 'Data Science — AI/ML Specialisation',
    slug: 'data-science',
    duration: '5 Months',
    level: 'Intermediate',
    hours: '280+',
    projects: 3,
    includes: [
      '280+ hours of live instruction',
      '3 portfolio projects with industry mentor review',
      'ML pipeline, Power BI dashboard, and NLP project',
      'SQL, statistics, and deep learning modules',
      '6 months placement support',
      '1-year access to recordings',
      'LearnSynaptic completion certificate',
      'Alumni Slack community',
    ],
  },
  {
    icon: Layers,
    tag: 'Best for Beginners',
    title: 'AI Beginner Bootcamp',
    slug: 'bootcamp',
    duration: '8 Weeks',
    level: 'Complete Beginner',
    hours: '80+',
    projects: 3,
    includes: [
      '80+ hours of live instruction over 8 weeks',
      '3 real projects, including a live deployed AI app',
      'Python, ChatGPT API, and no-code AI tools',
      'Cohort Slack for peer support',
      '6 months access to recorded sessions',
      'LearnSynaptic completion certificate',
      'Discount credit towards any longer program',
    ],
  },
];

const alwaysIncluded = [
  { title: 'Live + Recorded sessions', detail: 'Every class is live and recorded. Miss one? Catch up within 24 hours.' },
  { title: '0% interest EMI', detail: 'All programs offer equal monthly installments via Razorpay — no processing fee.' },
  { title: 'No hidden charges', detail: 'The fee you agree to covers everything: sessions, recordings, project reviews, and placement support.' },
  { title: 'Refund policy', detail: 'Full refund within 7 days of your batch starting. Pro-rated after that — no questions asked.' },
  { title: 'Weekend batch options', detail: 'Every program has a weekend cohort for working professionals who cannot take leave.' },
  { title: 'Placement support', detail: 'Resume reviews, mock interviews, and direct referrals to 60+ hiring partners for 6 months post-completion.' },
];

export default function PricingPage() {
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
              <MessageCircle size={12} />
              Pricing discussed on a free call
            </span>
            <h1 className="mb-5" style={{ maxWidth: 760 }}>
              What&apos;s in each program — and how to find out the fee.
            </h1>
            <p
              className="text-lg"
              style={{ color: 'var(--ls-muted)', maxWidth: 580, lineHeight: 1.7 }}
            >
              We don&apos;t publish prices publicly because the right program and payment arrangement
              depends on where you are right now. A 30-minute call costs nothing — and we&apos;d
              rather give you an honest answer than a price tag.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/contact" className="ls-btn-primary">
                Talk to Us About Pricing
                <ArrowRight size={16} />
              </Link>
              <Link href="/programs" className="ls-btn-outline">
                Compare All Programs
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Program feature cards ────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">What&apos;s included in each program</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              Every program includes live instruction, mentor project review, placement support,
              and a completion certificate. Here&apos;s the full breakdown per track.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {programs.map((p) => {
              const Icon = p.icon;
              return (
                <StaggerItem key={p.slug}>
                  <div
                    className="bg-white rounded-2xl border flex flex-col h-full"
                    style={{ borderColor: 'var(--ls-border)' }}
                  >
                    <div className="p-6 pb-0">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: 'var(--ls-blue-tint)' }}
                        >
                          <Icon size={20} style={{ color: 'var(--ls-blue-primary)' }} />
                        </div>
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'var(--ls-blue-tint)', color: 'var(--ls-blue-primary)' }}
                        >
                          {p.tag}
                        </span>
                      </div>
                      <h3 className="mb-3" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ls-text)' }}>
                        {p.title}
                      </h3>

                      {/* Quick meta */}
                      <div className="flex flex-wrap gap-3 mb-5">
                        {[
                          { label: 'Duration', value: p.duration },
                          { label: 'Level', value: p.level },
                          { label: 'Live hours', value: p.hours },
                        ].map(({ label, value }) => (
                          <div
                            key={label}
                            className="px-3 py-1.5 rounded-lg border text-xs"
                            style={{ borderColor: 'var(--ls-border)', background: 'var(--ls-bg-alt)' }}
                          >
                            <span style={{ color: 'var(--ls-muted)' }}>{label}: </span>
                            <span className="font-semibold" style={{ color: 'var(--ls-text)' }}>{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Feature list */}
                      <ul className="space-y-2.5 mb-5">
                        {p.includes.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--ls-success)' }} />
                            <span style={{ color: 'var(--ls-text)' }}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div
                      className="mt-auto p-6 pt-4 border-t"
                      style={{ borderColor: 'var(--ls-border)' }}
                    >
                      <div className="flex gap-2">
                        <Link
                          href="/contact"
                          className="ls-btn-primary flex-1 justify-center text-sm py-2.5"
                        >
                          Book a Demo
                          <ArrowRight size={14} />
                        </Link>
                        <Link
                          href={`/programs/${p.slug}`}
                          className="ls-btn-outline text-sm py-2.5 px-4"
                        >
                          Full Details
                        </Link>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Always included ─────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">Always included — across every program</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              These aren&apos;t add-ons or premium tiers. They come with every program, every batch.
            </p>
          </AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {alwaysIncluded.map((item) => (
              <StaggerItem key={item.title}>
                <div
                  className="bg-white rounded-2xl border p-5 h-full"
                  style={{ borderColor: 'var(--ls-border)' }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                      style={{ background: 'var(--ls-blue-tint)' }}
                    >
                      <CheckCircle2 size={15} style={{ color: 'var(--ls-blue-primary)' }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-1" style={{ color: 'var(--ls-text)' }}>
                        {item.title}
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--ls-muted)' }}>
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── How to get pricing ──────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <h2 className="mb-4">How to get the exact fee</h2>
                <div className="space-y-4 mb-8">
                  {[
                    { step: '01', text: 'Book a free 30-minute counselling call below.' },
                    { step: '02', text: 'We\'ll understand your background, goals, and which program fits.' },
                    { step: '03', text: 'We share exact fees, EMI options, and the next available batch — no pressure, no pitch.' },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex items-start gap-4">
                      <span
                        className="shrink-0 text-3xl font-black leading-none"
                        style={{ color: 'var(--ls-blue-tint)' }}
                      >
                        {step}
                      </span>
                      <p className="text-base pt-1" style={{ color: 'var(--ls-text)' }}>{text}</p>
                    </div>
                  ))}
                </div>
                <Link href="/contact" className="ls-btn-primary">
                  Book a Free Counselling Call
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div
                className="rounded-2xl p-8"
                style={{ background: 'var(--ls-bg-alt)', border: '1px solid var(--ls-border)' }}
              >
                <h3 className="mb-5" style={{ fontSize: '1rem', fontWeight: 700 }}>Common questions about fees</h3>
                <div className="space-y-5">
                  {[
                    {
                      q: 'Is the fee different for weekday vs weekend batches?',
                      a: 'The fee is the same for both batch types. The format changes, the curriculum and quality do not.',
                    },
                    {
                      q: 'Can I pay in installments?',
                      a: 'Yes — 0% interest EMI via Razorpay. A registration fee reserves your seat; it\'s adjusted against the total.',
                    },
                    {
                      q: 'What\'s the refund policy?',
                      a: 'Full refund within 7 days of your batch starting. After 7 days, pro-rated by how much of the program has been delivered.',
                    },
                    {
                      q: 'Are there any scholarships or discounts?',
                      a: 'Yes — referral discounts for students who bring a friend. Reach out directly if cost is a barrier.',
                    },
                  ].map(({ q, a }) => (
                    <div
                      key={q}
                      className="pb-5"
                      style={{ borderBottom: '1px solid var(--ls-border)' }}
                    >
                      <p className="font-semibold text-sm mb-1.5" style={{ color: 'var(--ls-text)' }}>{q}</p>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--ls-muted)' }}>{a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '96px 0' }}>
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <h2 className="mb-4" style={{ color: '#fff', maxWidth: 620, margin: '0 auto 1rem' }}>
              Let&apos;s find the right program and make it work financially.
            </h2>
            <p
              className="text-lg mb-8"
              style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 500, margin: '0 auto 2rem', lineHeight: 1.7 }}
            >
              A 30-minute call is enough to get program details, exact fees, and EMI options —
              with no sales pressure and no commitment required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 transition-transform"
                style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}
              >
                Talk to Us About Pricing
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/programs"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl border-2 hover:-translate-y-0.5 transition-transform"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', fontSize: '0.9375rem' }}
              >
                Explore Programs
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
