import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, MapPin, Code2, Users, BookOpen, Zap, CheckCircle2,
} from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';
import { AboutGallery } from '@/components/AboutGallery';

export const metadata: Metadata = {
  title: 'About Pratik Sabale — Founder, LearnSynaptic',
  description:
    'MERN Stack Developer and EdTech founder based in Pune. 3-4 years building real products and training developers. LearnSynaptic is already running — 5+ batches, 200+ students trained.',
  keywords: ['Pratik Sabale', 'LearnSynaptic founder', 'MERN developer trainer Pune', 'EdTech founder India'],
};

// Timeline dates are placeholders — [EDIT] markers for Pratik to fill exact dates
const timeline = [
  {
    // [EDIT] Replace with exact month + year when MERN training started
    date: '[EDIT: e.g. Jan 2022]',
    label: 'Started training MERN batches in Pune',
    detail: 'First cohort was small — 8 students, a shared screen, and a lot of debugging sessions. The curriculum was rough but the feedback was clear: hands-on beats theory every time.',
  },
  {
    // [EDIT] Replace with exact month + year GenAI Builder launched
    date: '[EDIT: e.g. Late 2023]',
    label: 'Launched the GenAI Builder Program',
    detail: 'When LLMs went mainstream, the demand for "how do I actually build with this?" spiked overnight. Built the GenAI Builder curriculum from scratch to answer exactly that.',
  },
  {
    // [EDIT] Replace with exact month + year milestone was reached
    date: '[EDIT: e.g. Mid 2024]',
    label: 'Crossed 5+ batches, 200+ students trained',
    detail: "The number that mattered wasn't the total — it was seeing former students get hired and come back to say it changed their trajectory. That's what made this feel like something worth scaling.",
  },
  {
    date: 'Today',
    label: 'Running 4 programs across India',
    detail: 'AI Full Stack Dev + DevOps, GenAI Builder → Freelancer, Data Science AI/ML, and AI Beginner Bootcamp — all active, all live. Pune origin, pan-India reach.',
    current: true,
  },
];

const philosophy = [
  {
    principle: '"Theory without building is useless."',
    body: "Every topic in every program is taught through something you make. If you can't deploy it, explain it to a client, or demo it in an interview — we didn't do our job.",
  },
  {
    principle: '"Tools without understanding are dangerous."',
    body: 'Using ChatGPT, LangChain, or Docker without knowing why things work means you can\'t debug when they break. We teach the layer below the tool — always.',
  },
  {
    principle: '"Real projects beat certificates."',
    body: "A live GitHub repo and a deployed app with a public URL will get you further than a certificate PDF. We grade you by what you've shipped, not what you've submitted.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="pt-32 pb-16 lg:pt-40 lg:pb-20"
        style={{ background: 'var(--ls-hero-bg)' }}
      >
        <div className="ls-container">
          <AnimateOnScroll>
            <span className="ls-badge mb-5 inline-flex">
              <MapPin size={12} />
              Pune, Maharashtra · Pan-India
            </span>
            <h1 className="mb-5" style={{ maxWidth: 820 }}>
              Built by someone who&apos;s actually doing it.
            </h1>
            <p
              className="text-xl"
              style={{ color: 'var(--ls-muted)', maxWidth: 580, lineHeight: 1.7 }}
            >
              I&apos;m a MERN Stack Developer and EdTech founder. LearnSynaptic isn&apos;t a planned launch —
              it&apos;s already running. 5+ batches, 200+ students, and I still take every class myself.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Bio (asymmetric — text left, photo right) ─────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            {/* Left — text block, wider */}
            <AnimateOnScroll className="lg:col-span-3">
              <div className="flex items-center gap-2 mb-6">
                <Code2 size={16} style={{ color: 'var(--ls-blue-primary)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--ls-muted)' }}>
                  MERN Developer → EdTech Founder
                </span>
              </div>

              <div className="space-y-5 text-base" style={{ color: 'var(--ls-muted)', maxWidth: 620, lineHeight: 1.75 }}>
                <p style={{ color: 'var(--ls-text)', fontWeight: 500, fontSize: '1.125rem' }}>
                  I&apos;m Pratik Sabale — a full-stack developer based in Pune with 3–4 years of experience
                  building real products and training developers who wanted to build real products too.
                </p>
                <p>
                  I started LearnSynaptic because I kept seeing the same gap: engineers who could pass an
                  interview but couldn&apos;t build a feature from scratch, or graduates who knew theory but
                  had never deployed anything. I wasn&apos;t trying to create a course platform. I was trying
                  to solve a problem I watched repeat itself batch after batch.
                </p>
                <p>
                  Right now I&apos;m running MERN stack and Python-focused batches in parallel, and I&apos;m building
                  every curriculum update alongside my own development work. The AI modules I teach today
                  are the same things I used in client projects last month. That&apos;s not a selling line — it&apos;s
                  the only way I know how to teach.
                </p>
                <p>
                  I don&apos;t position myself as a guru or a mentor with a fancy title. I&apos;m a developer who runs
                  training programs, shares the process publicly, and measures success by what graduates
                  actually build and where they end up. 5+ batches in, that&apos;s starting to speak for itself.
                </p>
              </div>

              <div className="flex flex-wrap gap-5 mt-8">
                {[
                  { value: '5-6 yrs', label: 'Industry experience', Icon: Code2 },
                  { value: '45+', label: 'Batches completed', Icon: BookOpen },
                  { value: '1200+', label: 'Students trained', Icon: Users },
                ].map(({ value, label, Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--ls-blue-tint)' }}
                    >
                      <Icon size={18} style={{ color: 'var(--ls-blue-primary)' }} />
                    </div>
                    <div>
                      <p className="text-xl font-bold" style={{ color: 'var(--ls-text)' }}>{value}</p>
                      <p className="text-xs" style={{ color: 'var(--ls-muted)' }}>{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AnimateOnScroll>

            {/* Right — founder card (photo placeholder) */}
            <AnimateOnScroll className="lg:col-span-2" delay={0.12}>
              <div
                className="rounded-2xl overflow-hidden border"
                style={{ borderColor: 'var(--ls-border)' }}
              >
                {/* Photo placeholder — swap with real headshot before launch */}
                <div
                  className="w-full flex flex-col items-center justify-center py-16"
                  style={{ background: 'var(--ls-blue-tint)', minHeight: 300 }}
                >
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-white mb-4"
                    style={{ background: 'var(--ls-blue-primary)' }}
                  >
                    PS
                  </div>
                  <p className="font-semibold" style={{ color: 'var(--ls-text)' }}>Pratik Sabale</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--ls-muted)' }}>Founder, LearnSynaptic</p>
                  {/* TODO: replace this div with <Image> of real headshot */}
                  <span
                    className="mt-4 text-xs px-3 py-1.5 rounded-full"
                    style={{ background: 'white', color: 'var(--ls-muted)' }}
                  >
                    Photo placeholder
                  </span>
                </div>
                <div className="p-5" style={{ background: 'white' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin size={13} style={{ color: 'var(--ls-blue-primary)' }} />
                    <span className="text-sm" style={{ color: 'var(--ls-muted)' }}>Pune, Maharashtra</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['MERN Stack', 'Python', 'GenAI', 'DevOps', 'EdTech'].map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-medium px-2.5 py-1 rounded-full border"
                        style={{ borderColor: 'var(--ls-border)', color: 'var(--ls-muted)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 flex gap-4 text-sm" style={{ borderTop: '1px solid var(--ls-border)' }}>
                    <a
                      href="https://instagram.com/pratiksabale.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium"
                      style={{ color: 'var(--ls-blue-primary)' }}
                    >
                      @pratiksabale.ai
                    </a>
                    <a
                      href="https://pratiksabale.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium"
                      style={{ color: 'var(--ls-blue-primary)' }}
                    >
                      pratiksabale.com
                    </a>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* ── Teaching Philosophy ──────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">How I teach</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              Three principles that run through every program I build. Not policies — convictions
              I&apos;ve developed from watching what actually works.
            </p>
          </AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {philosophy.map((p) => (
              <StaggerItem key={p.principle}>
                <div
                  className="bg-white rounded-2xl border p-7 h-full"
                  style={{ borderColor: 'var(--ls-border)' }}
                >
                  <Zap size={20} className="mb-4" style={{ color: 'var(--ls-blue-primary)' }} />
                  <p
                    className="text-lg font-bold mb-3 leading-snug"
                    style={{ color: 'var(--ls-text)' }}
                  >
                    {p.principle}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ls-muted)' }}>
                    {p.body}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">How we got here</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 480 }}>
              LearnSynaptic didn&apos;t start with a business plan. It started with a batch.
            </p>
          </AnimateOnScroll>

          <div className="max-w-2xl">
            {timeline.map((item, i) => (
              <AnimateOnScroll key={i} delay={i * 0.08}>
                <div className="flex gap-6 mb-8 last:mb-0">
                  {/* Timeline bar */}
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className="w-3 h-3 rounded-full mt-1.5"
                      style={{
                        background: item.current ? 'var(--ls-blue-primary)' : 'var(--ls-border)',
                        border: item.current ? '3px solid var(--ls-blue-tint)' : undefined,
                      }}
                    />
                    {i < timeline.length - 1 && (
                      <div
                        className="w-px flex-1 mt-2"
                        style={{ background: 'var(--ls-border)', minHeight: 40 }}
                      />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-2">
                    <span
                      className="text-xs font-semibold font-mono"
                      style={{ color: item.current ? 'var(--ls-blue-primary)' : 'var(--ls-muted)' }}
                    >
                      {item.date}
                    </span>
                    <p
                      className="font-semibold mt-1 mb-1.5"
                      style={{ color: 'var(--ls-text)', fontSize: '0.9375rem' }}
                    >
                      {item.label}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--ls-muted)' }}>
                      {item.detail}
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission ──────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <AnimateOnScroll>
              <h2 className="mb-5">The mission</h2>
              <div className="space-y-4 text-base" style={{ color: 'var(--ls-muted)', lineHeight: 1.75 }}>
                <p>
                  India is producing hundreds of thousands of engineering graduates every year. Most
                  of them are smart, motivated, and completely unprepared for what tech companies
                  actually need. That gap isn&apos;t a student problem — it&apos;s a curriculum problem.
                </p>
                <p>
                  LearnSynaptic exists to build India&apos;s next generation of AI-ready developers.
                  Not by teaching more content, but by teaching the right content in the right sequence —
                  with real projects, real feedback, and a direct line to the job market.
                </p>
                <p>
                  We started in Pune because that&apos;s where I am. But the batch I&apos;m running right now
                  has students from Hyderabad, Bangalore, Delhi, and Nagpur. The platform is pan-India.
                  The origin is Pune. The goal is to train every serious student who wants to build
                  a tech career — wherever they are.
                </p>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll delay={0.12}>
              <div className="space-y-4">
                {[
                  'Build India\'s AI-ready developer community',
                  'Every student leaves with a portfolio that works in the real world',
                  'Pune origin, pan-India reach — online-first delivery',
                  'Measure success by placements and outcomes, not completions',
                  'Keep curriculum current by staying active as a developer',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2
                      size={16}
                      className="mt-0.5 shrink-0"
                      style={{ color: 'var(--ls-success)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--ls-text)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* ── Gallery ─────────────────────────────────────────────────────── */}
      <AboutGallery />

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '88px 0' }}>
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <h2 className="mb-4" style={{ color: '#fff', maxWidth: 600, margin: '0 auto 1rem' }}>
              Come learn with someone who&apos;s still building.
            </h2>
            <p
              className="text-lg mb-8"
              style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 480, margin: '0 auto 2rem' }}
            >
              Batches run regularly — check the programs page for current start dates. If you want
              to build real things and get real outcomes, that&apos;s what we do here.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/programs"
                className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 transition-transform"
                style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}
              >
                Explore Programs <ArrowRight size={16} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl border-2 hover:-translate-y-0.5 transition-transform"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', fontSize: '0.9375rem' }}
              >
                Talk to Pratik
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
