import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Star,
  Clock,
  ArrowRight,
  Users,
  TrendingUp,
  Building2,
  BookOpen,
  Code2,
  Brain,
  Layers,
  CheckCircle2,
  Quote,
} from 'lucide-react';
import HeroSection from '@/components/HeroSection';
import { LogoMarquee } from '@/components/LogoMarquee';
import {
  AnimateOnScroll,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui/AnimateOnScroll';
import { TiltCard } from '@/components/ui/TiltCard';
import { TestimonialCard } from '@/components/TestimonialCard';
import { StatCard } from '@/components/StatCard';
import { HomepageGalleryStrip } from '@/components/HomepageGalleryStrip';

export const metadata: Metadata = {
  title: 'LearnSynaptic — AI, Full Stack & Data Science Training in India',
  description:
    'Build your tech career with LearnSynaptic. Industry-led AI, Full Stack Dev, GenAI, and Data Science programs. Pune-based, training students across India. 85% placement rate.',
  openGraph: {
    title: 'LearnSynaptic — AI & Tech Training for India',
    description:
      'Structured AI, Full Stack, and Data Science training for students and professionals. Real projects, expert mentors, verified placements.',
  },
};

/* ── Data ─────────────────────────────────────────────────────────────────── */

const stats = [
  { value: '1200+', label: 'Students Trained', Icon: Users },
  { value: '75%', label: 'Placement Rate', Icon: TrendingUp, green: true },
  { value: '60+', label: 'Hiring Partners', Icon: Building2 },
  { value: '50+', label: 'Batches Completed', Icon: BookOpen },
];

const programs = [
  {
    tag: 'Most Popular',
    icon: Code2,
    title: 'AI Powered Full Stack Dev + DevOps',
    rating: 4.9,
    reviews: 128,
    duration: '6 Months',
    batchDate: 'Jul 14, 2026',
    builds: [
      'AI-powered e-commerce app with React & Node.js',
      'Automated CI/CD pipeline deployed on AWS',
      'Containerised microservices with Docker & Kubernetes',
    ],
    href: '/programs/full-stack-devops',
    seatLabel: '4 seats left',
  },
  {
    tag: 'High Demand',
    icon: Brain,
    title: 'GenAI Builder → Freelancer Program',
    rating: 4.8,
    reviews: 96,
    duration: '3 Months',
    batchDate: 'Aug 5, 2026',
    builds: [
      'Custom AI chatbot with your own knowledge base',
      'RAG-powered document Q&A system',
      'Freelance-ready portfolio with 3 client projects',
    ],
    href: '/programs/genai-builder',
    seatLabel: '8 seats left',
  },
  {
    tag: 'Career Booster',
    icon: TrendingUp,
    title: 'Data Science — AI/ML Specialisation',
    rating: 4.8,
    reviews: 84,
    duration: '5 Months',
    batchDate: 'Jul 21, 2026',
    builds: [
      'Predictive ML model with 90%+ accuracy on real data',
      'Interactive Power BI dashboard from scratch',
      'NLP sentiment analysis pipeline end-to-end',
    ],
    href: '/programs/data-science',
    seatLabel: '6 seats left',
  },
  {
    tag: 'Best for Beginners',
    icon: Layers,
    title: 'AI Beginner Bootcamp',
    rating: 4.7,
    reviews: 156,
    duration: '8 Weeks',
    batchDate: 'Jul 7, 2026',
    builds: [
      'First Python automation script (0 experience needed)',
      'AI chatbot using the ChatGPT API',
      'Personal productivity tool with AI integration',
    ],
    href: '/programs/bootcamp',
    seatLabel: '12 seats left',
  },
];

const whyPoints = [
  {
    title: 'Industry-Aligned Curriculum',
    body: 'Built with hiring managers, not textbooks. Every module maps to a real job skill that companies are actively hiring for.',
  },
  {
    title: 'Hands-On Project Portfolio',
    body: 'Every program includes 3+ production-grade projects you own and can show in interviews. No toy examples.',
  },
  {
    title: 'Dedicated Placement Support',
    body: 'Mock interviews, resume reviews, LinkedIn optimisation, and direct referrals to 60+ hiring partners.',
  },
  {
    title: 'Flexible Weekend Batches',
    body: 'Working professionals can join weekend cohorts without leaving their current job. No forced leave required.',
  },
];

const testimonials = [
  {
    name: 'Ravi Kumar',
    role: 'B.E. Graduate → Full Stack Developer at Wipro',
    quote:
      'The AI Full Stack program changed my trajectory completely. I went from struggling with interviews to getting placed in 4 months. The portfolio projects are what got me noticed — every interviewer asked about them.',
    badge: '₹6.2 LPA Package',
    initials: 'RK',
  },
  {
    name: 'Priya Sharma',
    role: 'BPO Executive → Data Analyst at Deloitte',
    quote:
      'I was stuck in a dead-end job for 3 years. The Data Science program gave me both the skills and the confidence to make the switch. The placement team was incredible — 8 companies reached out to me.',
    badge: '2.5× Salary Hike',
    initials: 'PS',
  },
  {
    name: 'Aditya Patil',
    role: 'Final Year Student → Freelance GenAI Developer',
    quote:
      "I started getting freelance clients before even finishing the program. The GenAI Builder course gave me real projects to show clients, and now I earn more than my friends in full-time jobs.",
    badge: '₹55K/month Freelance',
    initials: 'AP',
  },
];

const hiringPartners = [
  'Wipro', 'TCS', 'Infosys', 'Deloitte', 'Accenture',
  'Cognizant', 'HCL', 'Tech Mahindra', 'Persistent Systems', 'KPMG',
];

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <>
      {/* ── 1. Hero ──────────────────────────────────────────────────────── */}
      <HeroSection />

      {/* ── 1b. Logo Marquee ──────────────────────────────────────────────── */}
      <LogoMarquee />

      {/* ── 2. Stat Band ─────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '56px 0' }}>
        <div className="ls-container">
          <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {stats.map(({ value, label, Icon, green }) => (
              <StaggerItem key={label}>
                <StatCard value={value} label={label} Icon={Icon} green={green} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── 3. Programs Grid ─────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="text-center mb-12">
            <h2 className="mb-3">Four Programs. One Clear Career Path.</h2>
            <p
              className="text-lg"
              style={{ maxWidth: 560, margin: '0 auto', color: 'var(--ls-muted)' }}
            >
              Whether you&apos;re a complete beginner or an engineer wanting to level up,
              there&apos;s a program built for your exact starting point.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {programs.map((program) => {
              const Icon = program.icon;
              return (
                <StaggerItem key={program.href}>
                  <TiltCard
                    className="bg-white rounded-2xl border p-6 h-full flex flex-col"
                    style={{ borderColor: 'var(--ls-border)' }}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="tilt-inner-icon w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--ls-blue-tint)' }}
                      >
                        <Icon size={20} style={{ color: 'var(--ls-blue-primary)' }} />
                      </div>
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          background: 'var(--ls-blue-tint)',
                          color: 'var(--ls-blue-primary)',
                        }}
                      >
                        {program.tag}
                      </span>
                    </div>

                    <h3
                      className="tilt-inner-title mb-3"
                      style={{ color: 'var(--ls-text)', fontSize: '1.05rem', fontWeight: 700 }}
                    >
                      {program.title}
                    </h3>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            fill={i < Math.floor(program.rating) ? '#f59e0b' : 'none'}
                            color="#f59e0b"
                          />
                        ))}
                        <span className="text-xs font-semibold ml-1" style={{ color: 'var(--ls-text)' }}>
                          {program.rating}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--ls-muted)' }}>
                          &nbsp;({program.reviews} reviews)
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border"
                        style={{ color: 'var(--ls-muted)', borderColor: 'var(--ls-border)' }}
                      >
                        <Clock size={11} />
                        &nbsp;{program.duration}
                      </div>
                    </div>

                    {/* What you'll build */}
                    <div className="mb-5 flex-1">
                      <p
                        className="text-xs font-semibold uppercase tracking-wider mb-2.5"
                        style={{ color: 'var(--ls-muted)' }}
                      >
                        What you&apos;ll build
                      </p>
                      <ol className="space-y-2">
                        {program.builds.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span
                              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                              style={{
                                background: 'var(--ls-blue-tint)',
                                color: 'var(--ls-blue-primary)',
                              }}
                            >
                              {i + 1}
                            </span>
                            <span style={{ color: 'var(--ls-text)' }}>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Batch date */}
                    <div
                      className="mb-4 px-3 py-2 rounded-lg text-xs"
                      style={{ background: 'var(--ls-bg-alt)' }}
                    >
                      <span style={{ color: 'var(--ls-muted)' }}>
                        Next batch:{' '}
                        <strong style={{ color: 'var(--ls-text)' }}>{program.batchDate}</strong>
                      </span>
                    </div>

                    {/* CTAs */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={program.href}
                        className="ls-btn-primary flex-1 justify-center text-sm py-2.5"
                      >
                        Explore Program
                      </Link>
                      <Link
                        href={`${program.href}#brochure`}
                        className="ls-btn-outline text-sm py-2.5 px-4"
                      >
                        Brochure
                      </Link>
                    </div>
                  </TiltCard>
                </StaggerItem>
              );
            })}
          </StaggerContainer>

          <AnimateOnScroll className="text-center mt-8">
            <Link href="/programs" className="ls-btn-outline">
              Compare All Programs
              <ArrowRight size={15} />
            </Link>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── 3b. Life at LearnSynaptic Gallery Strip ──────────────────────── */}
      <HomepageGalleryStrip />

      {/* ── 4. Why LearnSynaptic (asymmetric — deliberate layout break) ──── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Left — sticky heading */}
            <AnimateOnScroll>
              <div className="lg:sticky lg:top-28">
                <span className="ls-badge mb-4 inline-flex">Why us</span>
                <h2 className="mb-4">
                  We teach what companies actually hire for
                </h2>
                <p
                  className="text-base mb-6"
                  style={{ color: 'var(--ls-muted)', maxWidth: 480 }}
                >
                  Most courses teach tools. We teach you how to use those tools to build things
                  that get you hired. Every program is designed backwards from the job description.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/placements" className="ls-btn-primary">
                    See Placement Outcomes
                    <ArrowRight size={15} />
                  </Link>
                  <Link href="/about" className="ls-btn-outline">
                    Our Story
                  </Link>
                </div>
              </div>
            </AnimateOnScroll>

            {/* Right — feature cards */}
            <StaggerContainer className="space-y-5">
              {whyPoints.map((point, i) => (
                <StaggerItem key={i}>
                  <div
                    className="bg-white rounded-2xl border p-6"
                    style={{ borderColor: 'var(--ls-border)' }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                        style={{ background: 'var(--ls-blue-tint)' }}
                      >
                        <CheckCircle2 size={16} style={{ color: 'var(--ls-blue-primary)' }} />
                      </div>
                      <div>
                        <h3
                          className="mb-1"
                          style={{ color: 'var(--ls-text)', fontSize: '1rem', fontWeight: 700 }}
                        >
                          {point.title}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--ls-muted)' }}>
                          {point.body}
                        </p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </div>
      </section>

      {/* ── 5. Founder Snippet ───────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-center">
            {/* Text — wider */}
            <AnimateOnScroll className="lg:col-span-3">
              <span className="ls-badge mb-5 inline-flex">From the founder</span>
              <div className="mb-5">
                <Quote size={32} style={{ color: 'var(--ls-blue-tint)' }} />
              </div>
              <blockquote
                className="text-xl font-medium leading-relaxed mb-6"
                style={{ color: 'var(--ls-text)', maxWidth: 600 }}
              >
                I built the curriculum I wish I had when I started. I spent years in the
                industry watching smart graduates struggle because college never taught them what
                companies actually needed. LearnSynaptic exists to close that gap — for every
                student in India who deserves a fair shot at a tech career.
              </blockquote>
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white"
                  style={{ background: 'var(--ls-blue-primary)' }}
                >
                  PS
                </div>
                <div>
                  <p
                    className="font-bold text-base"
                    style={{ color: 'var(--ls-text)' }}
                  >
                    Pratik Sabale
                  </p>
                  <p className="text-sm" style={{ color: 'var(--ls-muted)' }}>
                    Founder &amp; Lead Trainer, LearnSynaptic · Pune, Maharashtra
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-6 mt-6">
                {[
                  { value: '6+', label: 'Years Industry Exp.' },
                  { value: '45+', label: 'Batches Delivered' },
                  { value: '1200+', label: 'Students Mentored' },
                ].map(({ value, label }) => (
                  <div key={label}>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: 'var(--ls-blue-primary)' }}
                    >
                      {value}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--ls-muted)' }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </AnimateOnScroll>

            {/* Photo placeholder — right column */}
            <AnimateOnScroll
              className="lg:col-span-2 flex justify-center lg:justify-end"
              delay={0.15}
            >
              <div
                className="w-64 h-72 rounded-3xl flex items-center justify-center"
                style={{
                  background: 'var(--ls-blue-tint)',
                  border: '1px solid var(--ls-border)',
                }}
              >
                <div className="flex flex-col items-center text-center px-6">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-3"
                    style={{ background: 'var(--ls-blue-primary)' }}
                  >
                    PS
                  </div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--ls-text)' }}>
                    Pratik Sabale
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--ls-muted)' }}>
                    Founder, LearnSynaptic
                  </p>
                  {/* TODO: replace with real photo */}
                  <span
                    className="mt-3 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: 'white', color: 'var(--ls-muted)' }}
                  >
                    Photo placeholder
                  </span>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* ── 6. Testimonials Preview ──────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="text-center mb-12">
            <h2 className="mb-3">Real students. Real outcomes.</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 500, margin: '0 auto' }}>
              Don&apos;t take our word for it. Here&apos;s what our graduates say — and
              where they are now.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <TestimonialCard
                  name={t.name}
                  role={t.role}
                  quote={t.quote}
                  badge={t.badge}
                  initials={t.initials}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>

          <AnimateOnScroll className="text-center mt-8">
            <Link href="/testimonials" className="ls-btn-outline">
              Read All Testimonials
              <ArrowRight size={15} />
            </Link>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── 7. Placements Preview ────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="text-center mb-10">
            <h2 className="mb-3">Our graduates work at</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 480, margin: '0 auto' }}>
              60+ companies across India actively hire from our programs.
              Our placement team makes the introductions.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="flex flex-wrap justify-center gap-3 mb-10">
            {hiringPartners.map((company) => (
              <StaggerItem key={company}>
                <div
                  className="px-5 py-2.5 rounded-xl border text-sm font-medium"
                  style={{
                    borderColor: 'var(--ls-border)',
                    color: 'var(--ls-text)',
                    background: 'white',
                  }}
                >
                  {company}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <AnimateOnScroll>
            <div
              className="rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6"
              style={{ background: 'var(--ls-bg-alt)', border: '1px solid var(--ls-border)' }}
            >
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp size={22} style={{ color: 'var(--ls-success)' }} />
                  <span
                    className="text-4xl font-bold"
                    style={{ color: 'var(--ls-success)', letterSpacing: '-0.02em' }}
                  >
                    85%
                  </span>
                  <span
                    className="text-lg font-semibold"
                    style={{ color: 'var(--ls-text)' }}
                  >
                    Placement Rate
                  </span>
                </div>
                <p style={{ color: 'var(--ls-muted)' }}>
                  Across all programs in the last 12 months, tracked post-completion.
                </p>
              </div>
              <Link href="/placements" className="ls-btn-primary shrink-0">
                View All Placements
                <ArrowRight size={15} />
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── 8. Final CTA ─────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '96px 0' }}>
        <div className="ls-container">
          <AnimateOnScroll className="text-center">
            <h2
              className="mb-4"
              style={{ color: '#fff', maxWidth: 700, margin: '0 auto 1rem' }}
            >
              The July cohort is open. Your next career step starts here.
            </h2>
            <p
              className="text-lg mb-8"
              style={{
                color: 'rgba(255,255,255,0.8)',
                maxWidth: 520,
                margin: '0 auto 2rem',
                lineHeight: 1.7,
              }}
            >
              Enroll in any program and get a free 30-minute career counselling session
              with our team — no commitment needed.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/programs"
                className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl transition-all hover:-translate-y-0.5"
                style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}
              >
                Explore Programs
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl border-2 transition-all hover:-translate-y-0.5"
                style={{
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.4)',
                  fontSize: '0.9375rem',
                }}
              >
                Talk to a Counsellor
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
