import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Clock, Users, TrendingUp, Code2, Brain, Layers, CheckCircle2,
} from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem, HoverCard } from '@/components/ui/AnimateOnScroll';

export const metadata: Metadata = {
  title: 'All Programs — AI, Full Stack & Data Science Courses in India',
  description:
    'Compare all 4 LearnSynaptic programs: AI Full Stack Dev + DevOps, GenAI Builder Freelancer, Data Science AI/ML, and AI Beginner Bootcamp. Find the right program for your career.',
};

const programs = [
  {
    icon: Code2,
    tag: 'Most Popular',
    title: 'AI Powered Full Stack Dev + DevOps',
    slug: 'full-stack-devops',
    level: 'Intermediate',
    duration: '6 Months',
    price: '₹49,999',
    emi: '₹5,555/mo',
    nextBatch: 'Jul 14, 2025',
    seats: 4,
    rating: 4.9,
    reviews: 128,
    description:
      'The complete path from frontend to backend to cloud deployment, with AI integration baked into every layer. Best for CSE/IT graduates and early-career engineers who want to build production-ready AI-powered web apps.',
    outcomes: [
      'Full stack React + Node.js developer',
      'DevOps engineer (Docker, AWS, CI/CD)',
      'AI-integrated application builder',
    ],
    tools: ['React', 'Next.js', 'Node.js', 'Docker', 'AWS', 'OpenAI API'],
    highlights: [
      '8 curriculum modules + capstone',
      '3 production-grade portfolio projects',
      'AWS deployment included',
      'AI features in every project',
    ],
  },
  {
    icon: Brain,
    tag: 'High Demand',
    title: 'GenAI Builder → Freelancer Program',
    slug: 'genai-builder',
    level: 'Beginner–Intermediate',
    duration: '3 Months',
    price: '₹29,999',
    emi: '₹3,333/mo',
    nextBatch: 'Aug 5, 2025',
    seats: 8,
    rating: 4.8,
    reviews: 96,
    description:
      'Turn AI skills into freelance income. Learn to build production-ready GenAI applications — chatbots, RAG systems, AI agents — and launch your freelancing career on Upwork and LinkedIn with real client projects in hand.',
    outcomes: [
      'GenAI application developer',
      'Freelancer earning ₹30K–₹80K/month',
      'LangChain & RAG specialist',
    ],
    tools: ['Python', 'LangChain', 'OpenAI', 'Hugging Face', 'Streamlit', 'FastAPI'],
    highlights: [
      '7 modules from Python to freelancing',
      '3 client-ready portfolio projects',
      'Freelance acquisition module included',
      'Start earning before graduation',
    ],
  },
  {
    icon: TrendingUp,
    tag: 'Career Booster',
    title: 'Data Science — AI/ML Specialisation',
    slug: 'data-science',
    level: 'Intermediate',
    duration: '5 Months',
    price: '₹39,999',
    emi: '₹4,444/mo',
    nextBatch: 'Jul 21, 2025',
    seats: 6,
    rating: 4.8,
    reviews: 84,
    description:
      'A deep-dive into the complete data science stack — from Python and SQL to machine learning, deep learning, and NLP. Ideal for graduates wanting analyst or ML engineer roles at analytics-driven companies.',
    outcomes: [
      'Data Scientist / ML Engineer',
      'Business / Data Analyst',
      'AI Research Engineer (junior)',
    ],
    tools: ['Python', 'Pandas', 'TensorFlow', 'Scikit-learn', 'SQL', 'Power BI'],
    highlights: [
      '8 modules covering the full DS stack',
      'Real-world ML pipeline project',
      'Power BI dashboard included',
      'NLP and deep learning modules',
    ],
  },
  {
    icon: Layers,
    tag: 'Best for Beginners',
    title: 'AI Beginner Bootcamp',
    slug: 'bootcamp',
    level: 'Complete Beginner',
    duration: '8 Weeks',
    price: '₹12,999',
    emi: '₹1,444/mo',
    nextBatch: 'Jul 7, 2025',
    seats: 12,
    rating: 4.7,
    reviews: 156,
    description:
      'The fastest way to go from zero to building with AI. Eight weeks covering Python basics, prompt engineering, the ChatGPT API, and no-code AI tools. Perfect for non-programmers who want to get hands-on immediately.',
    outcomes: [
      'Junior AI developer',
      'AI-powered content creator',
      'Tech-enabled professional in any field',
    ],
    tools: ['Python', 'ChatGPT API', 'Streamlit', 'Zapier', 'GitHub Copilot'],
    highlights: [
      'No coding experience required',
      '6 modules in 8 weeks',
      'Personal AI project by graduation',
      'Gateway to longer programs',
    ],
  },
];

const comparisonRows = [
  { label: 'Duration', values: ['6 months', '3 months', '5 months', '8 weeks'] },
  { label: 'Price', values: ['₹49,999', '₹29,999', '₹39,999', '₹12,999'] },
  { label: 'Level', values: ['Intermediate', 'Beg–Inter', 'Intermediate', 'Beginner'] },
  { label: 'Placement support', values: ['✓', '✓', '✓', '✓'] },
  { label: 'Weekend batch', values: ['✓', '✓', '✓', '✓'] },
  { label: 'EMI available', values: ['✓', '✓', '✓', '✓'] },
  { label: 'Freelancing module', values: ['—', '✓', '—', '—'] },
  { label: 'Cloud deployment', values: ['✓', '—', '—', '—'] },
  { label: 'Certificate', values: ['✓', '✓', '✓', '✓'] },
];

const pathGuide = [
  {
    who: 'Complete beginner / non-CS background',
    recommend: 'Start with AI Beginner Bootcamp, then upgrade to a full program.',
    href: '/programs/bootcamp',
  },
  {
    who: 'CS/IT graduate, no work experience',
    recommend: 'AI Full Stack Dev + DevOps — deepest placement support, highest demand.',
    href: '/programs/full-stack-devops',
  },
  {
    who: 'Want to freelance or work independently',
    recommend: 'GenAI Builder → Freelancer — designed specifically for solo income.',
    href: '/programs/genai-builder',
  },
  {
    who: 'Interested in analytics, data, or research roles',
    recommend: 'Data Science AI/ML Specialisation — full analyst + ML engineer track.',
    href: '/programs/data-science',
  },
];

export default function ProgramsPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="pt-32 pb-16 lg:pt-40 lg:pb-20"
        style={{ background: 'var(--ls-hero-bg)' }}
      >
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <span className="ls-badge mb-5 inline-flex">4 Programs · All Levels</span>
            <h1 className="mb-4">Find Your Program</h1>
            <p
              className="text-lg"
              style={{ color: 'var(--ls-muted)', maxWidth: 580, margin: '0 auto' }}
            >
              From complete beginner to advanced AI developer — compare all four programs,
              understand the outcomes, and pick the one that fits where you are right now.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Program Cards ───────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <StaggerContainer className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {programs.map((p) => {
              const Icon = p.icon;
              return (
                <StaggerItem key={p.slug}>
                  <HoverCard
                    className="bg-white rounded-2xl border flex flex-col h-full"
                    style={{ borderColor: 'var(--ls-border)' }}
                  >
                    {/* Card top */}
                    <div className="p-6 pb-0">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center"
                          style={{ background: 'var(--ls-blue-tint)' }}
                        >
                          <Icon size={22} style={{ color: 'var(--ls-blue-primary)' }} />
                        </div>
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'var(--ls-blue-tint)', color: 'var(--ls-blue-primary)' }}
                        >
                          {p.tag}
                        </span>
                      </div>
                      <h3 className="mb-2" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ls-text)' }}>
                        {p.title}
                      </h3>
                      <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--ls-muted)' }}>
                        {p.description}
                      </p>

                      {/* Key meta */}
                      <div className="flex flex-wrap gap-3 mb-5">
                        {[
                          { label: 'Duration', value: p.duration },
                          { label: 'Level', value: p.level },
                          { label: 'From', value: p.price },
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

                      {/* Outcomes */}
                      <div className="mb-5">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ls-muted)' }}>
                          Career outcomes
                        </p>
                        <ul className="space-y-1.5">
                          {p.outcomes.map((o) => (
                            <li key={o} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--ls-success)' }} />
                              <span style={{ color: 'var(--ls-text)' }}>{o}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Tools */}
                      <div className="mb-5">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ls-muted)' }}>
                          Tools you&apos;ll use
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {p.tools.map((t) => (
                            <span
                              key={t}
                              className="text-xs px-2.5 py-1 rounded-full border font-medium"
                              style={{ borderColor: 'var(--ls-border)', color: 'var(--ls-text)' }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card footer */}
                    <div
                      className="mt-auto p-6 pt-4 border-t"
                      style={{ borderColor: 'var(--ls-border)' }}
                    >
                      <div className="mb-4 text-xs" style={{ color: 'var(--ls-muted)' }}>
                        <span>
                          Next batch: <strong style={{ color: 'var(--ls-text)' }}>{p.nextBatch}</strong>
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={`/programs/${p.slug}`}
                          className="ls-btn-primary flex-1 justify-center text-sm py-2.5"
                        >
                          Explore Program
                          <ArrowRight size={14} />
                        </Link>
                        <Link
                          href="/contact"
                          className="ls-btn-outline text-sm py-2.5 px-4"
                        >
                          Ask Us
                        </Link>
                      </div>
                    </div>
                  </HoverCard>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Which program is right for you? ─────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">Not sure which to pick?</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              Your starting point determines the best path. Here&apos;s our honest recommendation for
              each type of student.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pathGuide.map((item) => (
              <StaggerItem key={item.href}>
                <div
                  className="bg-white rounded-2xl border p-6"
                  style={{ borderColor: 'var(--ls-border)' }}
                >
                  <div
                    className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--ls-blue-primary)' }}
                  >
                    If you are:
                  </div>
                  <p className="font-semibold mb-2" style={{ color: 'var(--ls-text)', fontSize: '0.9375rem' }}>
                    {item.who}
                  </p>
                  <p className="text-sm mb-4" style={{ color: 'var(--ls-muted)' }}>
                    {item.recommend}
                  </p>
                  <Link
                    href={item.href}
                    className="text-sm font-semibold flex items-center gap-1"
                    style={{ color: 'var(--ls-blue-primary)' }}
                  >
                    View program <ArrowRight size={13} />
                  </Link>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">Side-by-side comparison</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 480 }}>
              All programs include placement support, weekend batch options, EMI, and a completion certificate.
            </p>
          </AnimateOnScroll>

          <AnimateOnScroll>
            <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--ls-border)' }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr style={{ background: 'var(--ls-bg-alt)', borderBottom: '1px solid var(--ls-border)' }}>
                    <th className="text-left px-5 py-4 font-semibold" style={{ color: 'var(--ls-muted)', width: '22%' }}>
                      Feature
                    </th>
                    {programs.map((p) => (
                      <th
                        key={p.slug}
                        className="px-4 py-4 font-semibold text-center"
                        style={{ color: 'var(--ls-text)' }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <p.icon size={16} style={{ color: 'var(--ls-blue-primary)' }} />
                          <span className="text-xs leading-tight">{p.title.split(' ').slice(0, 3).join(' ')}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={row.label}
                      style={{
                        background: i % 2 === 0 ? '#fff' : 'var(--ls-bg-alt)',
                        borderBottom: '1px solid var(--ls-border)',
                      }}
                    >
                      <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--ls-text)' }}>
                        {row.label}
                      </td>
                      {row.values.map((v, j) => (
                        <td
                          key={j}
                          className="px-4 py-3.5 text-center"
                          style={{
                            color: v === '✓' ? 'var(--ls-success)' : v === '—' ? 'var(--ls-border)' : 'var(--ls-text)',
                            fontWeight: v === '✓' || v === '—' ? 600 : 500,
                          }}
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '88px 0' }}>
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <h2 className="mb-4" style={{ color: '#fff', maxWidth: 600, margin: '0 auto 1rem' }}>
              Still deciding? Talk to us first.
            </h2>
            <p
              className="text-lg mb-8"
              style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 480, margin: '0 auto 2rem' }}
            >
              A 15-minute call with our team is enough to know which program is right for you —
              no pressure, no sales pitch.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 transition-transform"
                style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}
              >
                Book a Free Counselling Call
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl border-2 hover:-translate-y-0.5 transition-transform"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', fontSize: '0.9375rem' }}
              >
                View Pricing & EMI
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
