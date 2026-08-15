import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Clock, Calendar, Users, CheckCircle2, Star,
  Code2, Server, Cloud, Cpu, Database, GitBranch, Layers, Quote,
} from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';
import { CurriculumAccordion } from '@/components/CurriculumAccordion';
import { ProgramFAQ } from '@/components/ProgramFAQ';

export const metadata: Metadata = {
  alternates: { canonical: '/programs/full-stack-devops' },
  title: 'AI Powered Full Stack Dev + DevOps Course — 6 Months | LearnSynaptic',
  description:
    'Master React, Node.js, Docker, AWS, and AI integration in 6 months. Build production-grade AI web apps and CI/CD pipelines. 85% placement rate. Ahilyanagar-based, pan-India batches.',
  keywords: ['full stack developer course India', 'AI full stack devops training', 'React Node.js course Ahilyanagar', 'devops training India'],
};

const curriculum = [
  {
    title: 'Web Foundations — HTML, CSS, JavaScript & TypeScript',
    duration: '2 weeks',
    description:
      'A rapid but solid foundation covering modern HTML5/CSS3, JavaScript ES6+, and TypeScript fundamentals. Designed for CSE graduates who need to consolidate scattered college knowledge into production habits.',
    topics: [
      'CSS flexbox, grid, and responsive design from scratch',
      'JavaScript: async/await, Promises, event loop, closures',
      'TypeScript: interfaces, generics, utility types',
      'Git workflow — branching, PRs, code reviews',
    ],
  },
  {
    title: 'React & Next.js 14 — Frontend Engineering',
    duration: '4 weeks',
    description:
      'Deep-dive into the React ecosystem with a focus on Next.js App Router, server components, and performance optimisation. You will build a complete multi-page app by the end of this module.',
    topics: [
      'React hooks: useState, useEffect, useContext, useRef, useMemo',
      'Next.js App Router, layouts, loading states, error boundaries',
      'Server Components vs Client Components — when to use which',
      'React Query / SWR for data fetching and caching',
      'SEO with Next.js metadata API, OG images',
    ],
  },
  {
    title: 'Backend with Node.js & Express',
    duration: '3 weeks',
    description:
      'Build robust REST APIs with Node.js and Express. We cover authentication patterns, middleware design, and production-grade error handling — the stuff college assignments skip entirely.',
    topics: [
      'Express routing, middleware pipeline, and error handling',
      'JWT authentication + refresh token rotation',
      'Input validation with Zod, rate limiting',
      'WebSockets and real-time features with Socket.io',
      'API design principles: versioning, pagination, filtering',
    ],
  },
  {
    title: 'Databases — MongoDB & PostgreSQL',
    duration: '2 weeks',
    description:
      'Understand when to use SQL vs NoSQL and become proficient in both. We use Mongoose for MongoDB and Prisma ORM for PostgreSQL — the two most common stacks in the industry.',
    topics: [
      'MongoDB CRUD, aggregation pipelines, indexing',
      'PostgreSQL schemas, foreign keys, joins, transactions',
      'Mongoose ODM and Prisma ORM in practice',
      'Database design for real applications',
      'Caching basics with Redis',
    ],
  },
  {
    title: 'AI Integration — OpenAI, LangChain & Vector Databases',
    duration: '3 weeks',
    description:
      'Learn to integrate AI features into your web applications using the OpenAI API, LangChain chains, and vector databases. This is the module that separates our graduates from standard full-stack engineers.',
    topics: [
      'OpenAI Chat Completions API — streaming, function calling',
      'Prompt engineering for production applications',
      'LangChain chains, agents, and tools',
      'Vector databases: Pinecone + semantic search',
      'Building a RAG-powered feature into a web app',
    ],
  },
  {
    title: 'DevOps Foundations — Docker & CI/CD',
    duration: '3 weeks',
    description:
      'Containerise your applications and build automated deployment pipelines. By the end of this module, you will have a working CI/CD pipeline that tests, builds, and deploys your app on every commit.',
    topics: [
      'Docker containers, images, and Docker Compose',
      'GitHub Actions — writing CI/CD workflows from scratch',
      'Automated testing in pipelines (Jest, Playwright)',
      'Environment variable management and secrets',
      'Kubernetes fundamentals — deployments, services, scaling',
    ],
  },
  {
    title: 'Cloud Deployment with AWS',
    duration: '2 weeks',
    description:
      'Deploy production-grade applications on AWS. We cover the most commonly used services in real companies — EC2, S3, RDS, Lambda — with a strong emphasis on security best practices.',
    topics: [
      'AWS IAM, security groups, VPC basics',
      'EC2 deployment with Nginx reverse proxy',
      'S3 for static assets and file uploads',
      'RDS (PostgreSQL) for production databases',
      'Lambda serverless functions and API Gateway',
    ],
  },
  {
    title: 'Capstone Project — Full AI-Powered App, End to End',
    duration: '4 weeks',
    description:
      'Build a complete, production-deployed application from scratch. This is your portfolio centrepiece — a real AI-powered product with a React frontend, Node.js backend, PostgreSQL database, AI features, and AWS deployment.',
    topics: [
      'Architecture planning and project brief review with mentors',
      'Sprint-based development with weekly code reviews',
      'Production deployment on AWS with custom domain',
      'Performance profiling and optimisation',
      'Final demo day and portfolio documentation',
    ],
  },
];

const tools = [
  { name: 'React', cat: 'Frontend' },
  { name: 'Next.js', cat: 'Frontend' },
  { name: 'TypeScript', cat: 'Frontend' },
  { name: 'Tailwind CSS', cat: 'Frontend' },
  { name: 'Node.js', cat: 'Backend' },
  { name: 'Express', cat: 'Backend' },
  { name: 'Prisma', cat: 'Backend' },
  { name: 'MongoDB', cat: 'Database' },
  { name: 'PostgreSQL', cat: 'Database' },
  { name: 'Redis', cat: 'Database' },
  { name: 'OpenAI API', cat: 'AI' },
  { name: 'LangChain', cat: 'AI' },
  { name: 'Pinecone', cat: 'AI' },
  { name: 'Docker', cat: 'DevOps' },
  { name: 'Kubernetes', cat: 'DevOps' },
  { name: 'GitHub Actions', cat: 'DevOps' },
  { name: 'AWS EC2', cat: 'Cloud' },
  { name: 'AWS S3', cat: 'Cloud' },
  { name: 'AWS Lambda', cat: 'Cloud' },
  { name: 'AWS RDS', cat: 'Cloud' },
];

const personas = [
  { who: 'CSE / IT graduates with 0–2 years experience', icon: Code2, detail: 'You have a degree but feel unprepared for industry. This program bridges the gap with exactly what companies need.' },
  { who: 'Backend or frontend devs wanting to go full stack', icon: Layers, detail: 'Already know one side? This adds the other — plus cloud, DevOps, and AI — in 6 structured months.' },
  { who: 'Engineers wanting to add AI to their skillset', icon: Cpu, detail: 'AI integration is now a baseline expectation. This is the most direct path to building AI-powered production apps.' },
];

const projects = [
  {
    num: '01',
    title: 'AI-Powered E-Commerce App',
    stack: 'React, Node.js, PostgreSQL, OpenAI',
    description: 'A full-stack marketplace with AI-generated product descriptions, personalised recommendation engine, and a conversational shopping assistant built with LangChain.',
  },
  {
    num: '02',
    title: 'Automated CI/CD Pipeline',
    stack: 'GitHub Actions, Docker, AWS',
    description: 'A complete deployment pipeline that runs tests, builds Docker images, pushes to ECR, and deploys to EC2 on every commit. Includes rollback and environment management.',
  },
  {
    num: '03',
    title: 'Containerised Microservices App',
    stack: 'Docker, Kubernetes, AWS EKS',
    description: 'A real-world microservices architecture with separate auth, product, and notification services — all containerised, orchestrated with K8s, and deployed on AWS.',
  },
];

const testimonials = [
  {
    name: 'Ravi Kumar',
    role: 'B.E. Graduate → Full Stack Developer at Wipro',
    quote: 'The AI Full Stack program changed my trajectory completely. I went from failing interviews to getting placed in 4 months. The AWS module alone made me stand out from 90% of candidates.',
    badge: '₹6.2 LPA Package',
    initials: 'RK',
  },
  {
    name: 'Sneha Desai',
    role: 'Frontend Dev → Full Stack + DevOps Engineer at Persistent Systems',
    quote: 'I knew React well but had no backend or cloud skills. Six months later I was deploying Kubernetes clusters at Persistent. The curriculum is exactly what industry needs.',
    badge: '₹9.5 LPA Package',
    initials: 'SD',
  },
];

const faqs = [
  {
    question: 'Do I need prior coding experience to join this program?',
    answer: 'You need basic programming knowledge — the ability to write loops, functions, and understand variables. Prior web development experience is helpful but not required. If you have zero coding experience, we recommend starting with the AI Beginner Bootcamp first.',
  },
  {
    question: 'How is the 6-month timeline structured?',
    answer: 'The program runs 5 days a week for 4 hours daily (weekday batch) or on weekends for 8 hours per day (weekend batch for working professionals). Total contact hours: ~360 hours of live instruction + assignments + capstone time.',
  },
  {
    question: 'What kind of placement support is provided?',
    answer: 'We provide mock technical interviews (DSA + system design), resume and LinkedIn optimisation, direct referrals to our 60+ hiring partners, and access to an exclusive alumni Slack network. Placement support continues for 6 months post-completion.',
  },
  {
    question: 'Is the DevOps + AWS content hands-on?',
    answer: 'Yes — every DevOps module uses real AWS accounts (we guide you through free-tier setup). You will deploy actual applications, not sandbox simulations. By the capstone, your app runs on production infrastructure you built yourself.',
  },
  {
    question: 'What is the difference between this and a typical MERN stack course?',
    answer: 'Three things: AI integration (OpenAI, LangChain, vector DBs), DevOps from day one (Docker, CI/CD, Kubernetes), and AWS deployment as a core skill — not an optional module. Standard MERN courses teach you to build; this teaches you to build, deploy, and maintain.',
  },
  {
    question: 'Are EMI options available?',
    answer: 'Yes. We offer 0% interest EMI in partnership with Razorpay — 9 equal monthly installments with no processing fee and no interest. A registration fee is required upfront to reserve your seat, which is adjusted against the total. Book a free call to get the exact breakdown.',
  },
  {
    question: 'What if I miss a live class?',
    answer: 'Every live session is recorded and uploaded to your learning portal within 4 hours. You can attend the recording, submit assignments, and still participate in project reviews. We do recommend live attendance for the weekly Q&A sessions.',
  },
  {
    question: 'Do I get a certificate after completion?',
    answer: 'Yes — a LearnSynaptic completion certificate with your capstone project listed. We also help you document your 3 projects on GitHub and LinkedIn so recruiters can verify your skills independently.',
  },
];

const batches = [
  { date: 'July 14, 2026', type: 'Weekday Batch', time: 'Mon–Fri, 7–11 PM IST', seats: 4 },
  { date: 'August 25, 2026', type: 'Weekend Batch', time: 'Sat–Sun, 10 AM–6 PM IST', seats: 12 },
  { date: 'October 6, 2026', type: 'Weekday Batch', time: 'Mon–Fri, 7–11 PM IST', seats: 20 },
];

export default function FullStackDevOpsPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="pt-32 pb-16 lg:pt-40 lg:pb-20"
        style={{ background: 'var(--ls-hero-bg)' }}
      >
        <div className="ls-container">
          <AnimateOnScroll>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="ls-badge"><Clock size={12} /> 6 Months</span>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: '#dcfce7', color: 'var(--ls-success)' }}
              >
                <Users size={12} /> Most Popular
              </span>
            </div>
            <h1 className="mb-4" style={{ maxWidth: 800 }}>
              AI Powered Full Stack Dev + DevOps
            </h1>
            <p
              className="text-xl mb-6"
              style={{ color: 'var(--ls-muted)', maxWidth: 620, lineHeight: 1.65 }}
            >
              Build production-grade AI-powered web applications and deploy them on AWS.
              The complete path from HTML to Kubernetes, with AI integration at every layer.
            </p>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-6 mb-8">
              {[
                { label: 'Duration', value: '6 Months', Icon: Clock },
                { label: 'Next Batch', value: 'Jul 14, 2026', Icon: Calendar },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={15} style={{ color: 'var(--ls-blue-primary)' }} />
                  <span className="text-sm" style={{ color: 'var(--ls-muted)' }}>{label}: </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--ls-text)' }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/contact" className="ls-btn-primary">
                Apply for This Program
                <ArrowRight size={16} />
              </Link>
              <Link href="#curriculum" className="ls-btn-outline">
                View Curriculum
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Overview (asymmetric — 2-col) ────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left — narrative */}
            <div className="lg:col-span-2">
              <AnimateOnScroll>
                <h2 className="mb-4">What makes this program different</h2>
                <div className="space-y-4 text-base" style={{ color: 'var(--ls-muted)', maxWidth: 640 }}>
                  <p>
                    Most full-stack courses teach you React + Node and call it done. This program goes 3 layers
                    deeper: AI integration using real OpenAI and LangChain APIs, DevOps from day one with Docker
                    and GitHub Actions, and cloud deployment on AWS as a core skill — not an optional final chapter.
                  </p>
                  <p>
                    By the time you graduate, you have deployed 3 real applications on AWS infrastructure you
                    built yourself, with working CI/CD pipelines that any company can immediately plug into.
                    That&apos;s what converts interviews into offers.
                  </p>
                </div>

                <div className="mt-8">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--ls-muted)' }}>
                    Who this is for
                  </p>
                  <div className="space-y-4">
                    {personas.map((p) => {
                      const Icon = p.icon;
                      return (
                        <div key={p.who} className="flex items-start gap-3">
                          <div
                            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                            style={{ background: 'var(--ls-blue-tint)' }}
                          >
                            <Icon size={15} style={{ color: 'var(--ls-blue-primary)' }} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--ls-text)' }}>{p.who}</p>
                            <p className="text-sm" style={{ color: 'var(--ls-muted)' }}>{p.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </AnimateOnScroll>
            </div>

            {/* Right — quick-specs card */}
            <AnimateOnScroll delay={0.1} className="lg:col-span-1">
              <div
                className="rounded-2xl border p-6 sticky top-28"
                style={{ borderColor: 'var(--ls-border)', background: 'var(--ls-bg-alt)' }}
              >
                <h3 className="mb-5" style={{ fontSize: '1rem', fontWeight: 700 }}>Program at a glance</h3>
                <div className="space-y-4">
                  {[
                    { icon: Clock, label: 'Duration', value: '6 Months' },
                    { icon: Users, label: 'Batch Size', value: 'Max 30 students' },
                    { icon: Calendar, label: 'Format', value: 'Live + Recorded' },
                    { icon: GitBranch, label: 'Projects', value: '3 portfolio projects' },
                    { icon: Star, label: 'Certificate', value: 'Yes, on completion' },
                    { icon: Cloud, label: 'Job Support', value: '6 months post-program' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2" style={{ color: 'var(--ls-muted)' }}>
                        <Icon size={14} />
                        {label}
                      </div>
                      <span className="font-semibold" style={{ color: 'var(--ls-text)' }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--ls-border)' }}>
                  <Link href="/contact" className="ls-btn-primary w-full justify-center text-sm">
                    Book a Demo
                  </Link>
                  <p className="text-xs mt-3 text-center" style={{ color: 'var(--ls-muted)' }}>
                    Free 30-min call — pricing discussed on call.
                  </p>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* ── What You'll Build ────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">3 Projects You&apos;ll Build & Deploy</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              Real applications on real infrastructure. Every project is deployed live and goes
              into your portfolio — not a local demo that disappears after submission.
            </p>
          </AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <StaggerItem key={proj.num}>
                <div
                  className="bg-white rounded-2xl border p-6 h-full"
                  style={{ borderColor: 'var(--ls-border)' }}
                >
                  <span
                    className="text-4xl font-black block mb-3"
                    style={{ color: 'var(--ls-blue-tint)', lineHeight: 1 }}
                  >
                    {proj.num}
                  </span>
                  <h3 className="mb-2" style={{ fontSize: '1rem', fontWeight: 700 }}>{proj.title}</h3>
                  <p
                    className="text-xs font-medium mb-3 px-2 py-1 rounded-md inline-block"
                    style={{ background: 'var(--ls-blue-tint)', color: 'var(--ls-blue-primary)' }}
                  >
                    {proj.stack}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ls-muted)' }}>{proj.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Curriculum ──────────────────────────────────────────────────── */}
      <section id="curriculum" className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8">
            <h2 className="mb-3">Full Curriculum — 8 Modules</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              23 weeks of structured learning, from zero to production. Click any module to see
              exactly what&apos;s covered.
            </p>
          </AnimateOnScroll>
          <AnimateOnScroll>
            <CurriculumAccordion modules={curriculum} />
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Tools ────────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8">
            <h2 className="mb-3">Tools & Technologies</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 480 }}>
              Everything you learn is a tool companies actually use in production today.
            </p>
          </AnimateOnScroll>
          {['Frontend', 'Backend', 'Database', 'AI', 'DevOps', 'Cloud'].map((cat) => (
            <AnimateOnScroll key={cat} className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ls-muted)' }}>
                {cat}
              </p>
              <div className="flex flex-wrap gap-2">
                {tools.filter((t) => t.cat === cat).map((t) => (
                  <span
                    key={t.name}
                    className="text-sm font-medium px-3.5 py-2 rounded-xl border bg-white"
                    style={{ borderColor: 'var(--ls-border)', color: 'var(--ls-text)' }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* ── Batch Dates ──────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8">
            <h2 className="mb-3">Upcoming Batches</h2>
          </AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {batches.map((b) => (
              <StaggerItem key={b.date}>
                <div
                  className="rounded-2xl border p-5"
                  style={{
                    borderColor: b.seats <= 6 ? 'var(--ls-blue-primary)' : 'var(--ls-border)',
                    background: b.seats <= 6 ? 'var(--ls-blue-tint)' : 'white',
                  }}
                >
                  {b.seats <= 6 && (
                    <span
                      className="text-xs font-semibold mb-2 inline-block"
                      style={{ color: 'var(--ls-blue-primary)' }}
                    >
                      FILLING FAST
                    </span>
                  )}
                  <p className="font-bold text-lg mb-1" style={{ color: 'var(--ls-text)' }}>{b.date}</p>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ls-text)' }}>{b.type}</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--ls-muted)' }}>{b.time}</p>
                  <p className="text-xs font-medium" style={{ color: b.seats <= 6 ? '#dc2626' : 'var(--ls-muted)' }}>
                    {b.seats} seats remaining
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── What's Included ──────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8">
            <h2 className="mb-3">What&apos;s Included</h2>
          </AnimateOnScroll>
          <AnimateOnScroll>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Features card */}
              <div
                className="rounded-2xl border p-8 bg-white"
                style={{ borderColor: 'var(--ls-border)' }}
              >
                <h3 className="mb-5" style={{ fontSize: '1rem', fontWeight: 700 }}>Everything in this program</h3>
                <ul className="space-y-3 mb-6">
                  {[
                    '360+ hours of live instruction',
                    '3 production-grade portfolio projects',
                    'AWS account setup & credits guidance',
                    '6 months placement support',
                    '1-year access to recorded sessions',
                    'LearnSynaptic completion certificate',
                    'Alumni Slack network access',
                    'Free re-sit for any module',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ls-success)' }} />
                      <span style={{ color: 'var(--ls-text)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/contact" className="ls-btn-primary w-full justify-center">
                  Get Program Details
                  <ArrowRight size={15} />
                </Link>
              </div>

              {/* Payment options */}
              <div className="space-y-4">
                <div
                  className="rounded-2xl border p-6 bg-white"
                  style={{ borderColor: 'var(--ls-border)' }}
                >
                  <h3 className="mb-4" style={{ fontSize: '1rem', fontWeight: 700 }}>Payment options</h3>
                  <div className="space-y-4">
                    {[
                      { label: '0% interest EMI', note: 'Equal monthly installments via Razorpay — no processing fee' },
                      { label: 'No hidden charges', note: 'Fee covers all sessions, recordings, project reviews, and placement support' },
                      { label: 'Refund policy', note: 'Full refund within 7 days of batch start, pro-rated after that' },
                    ].map(({ label, note }) => (
                      <div key={label} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ls-success)' }} />
                        <div>
                          <p style={{ color: 'var(--ls-text)', fontWeight: 500 }}>{label}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--ls-muted)' }}>{note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className="rounded-2xl p-5"
                  style={{ background: 'var(--ls-blue-tint)', border: '1px solid var(--ls-blue-primary)' }}
                >
                  <p className="font-semibold text-sm mb-2" style={{ color: 'var(--ls-text)' }}>
                    Talk to us about pricing
                  </p>
                  <p className="text-sm mb-4" style={{ color: 'var(--ls-muted)' }}>
                    Fees and EMI options are discussed on a free 30-minute counselling call. Cost should not be the only thing stopping a serious candidate from starting.
                  </p>
                  <Link href="/contact" className="text-sm font-semibold" style={{ color: 'var(--ls-blue-primary)' }}>
                    Book a free call →
                  </Link>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">From our Full Stack graduates</h2>
          </AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <div
                  className="bg-white rounded-2xl border p-6 h-full flex flex-col"
                  style={{ borderColor: 'var(--ls-border)' }}
                >
                  <Quote size={20} className="mb-4" style={{ color: 'var(--ls-blue-tint)' }} />
                  <p className="text-sm leading-relaxed flex-1 mb-5" style={{ color: 'var(--ls-text)' }}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div
                    className="flex items-center gap-3 pt-4"
                    style={{ borderTop: '1px solid var(--ls-border)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: 'var(--ls-blue-primary)' }}
                    >
                      {t.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--ls-text)' }}>{t.name}</p>
                      <p className="text-xs" style={{ color: 'var(--ls-muted)' }}>{t.role}</p>
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: '#dcfce7', color: 'var(--ls-success)' }}
                    >
                      {t.badge}
                    </span>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── FAQs ─────────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <AnimateOnScroll className="lg:col-span-1">
              <h2 className="mb-4">Frequently asked questions</h2>
              <p style={{ color: 'var(--ls-muted)' }}>
                Still have questions? Our counselling team answers within 2 hours on weekdays.
              </p>
              <Link href="/contact" className="ls-btn-outline mt-6 inline-flex">
                Ask a question
                <ArrowRight size={14} />
              </Link>
            </AnimateOnScroll>
            <AnimateOnScroll className="lg:col-span-2" delay={0.1}>
              <ProgramFAQ faqs={faqs} />
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '96px 0' }}>
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <h2 className="mb-4" style={{ color: '#fff', maxWidth: 620, margin: '0 auto 1rem' }}>
              Join the July 14 batch — 6 months to a deployed AI application.
            </h2>
            <p
              className="text-lg mb-8"
              style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 480, margin: '0 auto 2rem' }}
            >
              Talk to our team to get exact program details, confirm batch availability, and reserve your spot.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 transition-transform"
                style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}
              >
                Apply for July Batch
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/programs"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl border-2 hover:-translate-y-0.5 transition-transform"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', fontSize: '0.9375rem' }}
              >
                Compare Other Programs
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
