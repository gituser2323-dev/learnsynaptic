import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Clock, Calendar, Users, CheckCircle2, Star, Layers, Quote,
} from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';
import { CurriculumAccordion } from '@/components/CurriculumAccordion';
import { ProgramFAQ } from '@/components/ProgramFAQ';

export const metadata: Metadata = {
  title: 'AI Beginner Bootcamp — 8 Weeks | LearnSynaptic',
  description:
    'Zero experience to building with AI in 8 weeks. Python, prompt engineering, ChatGPT API, and automation tools. No coding background needed. Pune-based, pan-India batches.',
  keywords: ['AI beginner course India', 'AI bootcamp no experience', 'ChatGPT API course India', 'learn AI from scratch'],
};

const curriculum = [
  {
    title: 'Python Crash Course — From Zero to Functional',
    duration: '2 weeks',
    description:
      'Learn Python the way an AI developer uses it — not as a computer science exercise, but as a practical tool for building things. No prior coding experience required. We start from the very first line.',
    topics: [
      'Variables, data types: strings, numbers, lists, dictionaries',
      'Conditionals (if/else) and loops (for/while)',
      'Functions: writing reusable, clean code',
      'Installing Python, VS Code, and managing packages with pip',
      'Reading and writing files — your first useful Python script',
    ],
  },
  {
    title: 'Understanding AI & LLMs — How It All Works',
    duration: '1 week',
    description:
      'Before building with AI, understand what it actually is. This module cuts through the hype and gives you a clear, jargon-free model of how large language models work and where they fail.',
    topics: [
      'What is machine learning? What is an LLM?',
      'How models like GPT-4o are trained (the intuition, not the maths)',
      'AI vs ML vs Deep Learning — a practical map',
      'Real-world AI use cases across industries',
      'AI limitations, hallucinations, and ethical considerations',
    ],
  },
  {
    title: 'Prompt Engineering Basics — Getting Great Results from AI',
    duration: '1 week',
    description:
      'Prompt engineering is a skill. Most people use AI like a search engine — this module teaches you to use it like a collaborator. You will write prompts that get professional-quality outputs consistently.',
    topics: [
      'System prompts vs user prompts — what each is for',
      'Zero-shot and few-shot prompting',
      'Chain-of-thought: getting AI to reason step-by-step',
      'Iterating and improving prompts systematically',
      'Common mistakes: vagueness, scope creep, instructions that confuse the model',
    ],
  },
  {
    title: 'Building with the ChatGPT API — Your First AI Apps',
    duration: '2 weeks',
    description:
      'This is the hands-on core of the bootcamp. You will call the OpenAI API from Python and build real applications — a simple chatbot, a document summariser, an AI assistant that remembers context.',
    topics: [
      'Setting up your OpenAI API key and making your first API call',
      'Understanding the Chat Completions API — roles, messages, tokens',
      'Building a simple command-line chatbot with conversation history',
      'Adding memory to a chatbot: how to persist context across turns',
      'Handling errors, rate limits, and managing API costs',
    ],
  },
  {
    title: 'AI Automation & No-Code Tools',
    duration: '1 week',
    description:
      'Not every AI solution needs custom code. This module teaches you to automate real tasks using a combination of no-code tools and light Python — things you can use in any job the day you learn them.',
    topics: [
      'Zapier and Make (Integromat) for AI-powered automation',
      'GitHub Copilot for coding faster',
      'Notion AI for writing and document management',
      'Automating repetitive tasks at work with AI tools',
      'Building a useful automation in 2 hours (live exercise)',
    ],
  },
  {
    title: 'Final Project — Build Something Real',
    duration: '1 week',
    description:
      'Your capstone. You choose a problem you actually care about and build an AI-powered solution for it. By the end of this week, you have a working app you can show people and a deployed Streamlit link to share.',
    topics: [
      'Scoping your project (mentors help you keep it achievable)',
      'Building and iterating on feedback from your cohort',
      'Deploying your app on Streamlit Community Cloud (free)',
      'Documenting your project on GitHub',
      'Final demo day: present your project to the cohort and mentors',
    ],
  },
];

const tools = [
  { name: 'Python 3', cat: 'Core' },
  { name: 'VS Code', cat: 'Core' },
  { name: 'Google Colab', cat: 'Core' },
  { name: 'ChatGPT API', cat: 'AI' },
  { name: 'OpenAI API', cat: 'AI' },
  { name: 'GitHub Copilot', cat: 'AI' },
  { name: 'Streamlit', cat: 'App Building' },
  { name: 'Zapier', cat: 'Automation' },
  { name: 'Make (Integromat)', cat: 'Automation' },
  { name: 'Notion AI', cat: 'Productivity' },
  { name: 'GitHub', cat: 'Deployment' },
];

const projects = [
  {
    num: '01',
    title: 'Python Automation Script',
    stack: 'Python',
    description: 'A real script that automates something you actually do — maybe renaming files, extracting data from CSVs, or sending automated emails. Your first Python program that does something useful.',
  },
  {
    num: '02',
    title: 'AI Chatbot via ChatGPT API',
    stack: 'Python, OpenAI API',
    description: 'A conversational AI assistant built from scratch using the OpenAI API. You define the persona, set the system prompt, and add memory so it remembers the conversation across turns.',
  },
  {
    num: '03',
    title: 'Personal AI Tool — Deployed Live',
    stack: 'Python, Streamlit',
    description: 'Your capstone project, chosen and scoped by you. Deployed as a live Streamlit app with a public link you can share. Past examples include a resume analyser, a Hindi-to-English translator, and a meal planner.',
  },
];

const testimonials = [
  {
    name: 'Neha Kulkarni',
    role: 'HR Executive → AI-Assisted HR Consultant',
    quote: 'I work in HR with no coding background. After this bootcamp, I built an AI tool that screens candidate CVs in 30 seconds. My manager was shocked. I was too. Eight weeks changed how I work forever.',
    badge: 'Used at Work Immediately',
    initials: 'NK',
  },
  {
    name: 'Rohan Gaikwad',
    role: 'Second Year B.E. Student → AI Developer',
    quote: 'I tried to learn Python on YouTube for months and gave up twice. The bootcamp had me building an API chatbot by week 4. Having a mentor and a cohort makes all the difference — you cannot replicate that alone.',
    badge: 'Enrolled in Full Stack Program',
    initials: 'RG',
  },
];

const faqs = [
  {
    question: 'I have never written code in my life. Is this bootcamp really for me?',
    answer: 'Yes — this is genuinely the starting point we designed for non-programmers. The Python module assumes zero prior experience. In week 2, you will be writing your first script. In week 4, you will be calling an AI API. We move fast, but we do not skip steps.',
  },
  {
    question: 'How much time per week does this require?',
    answer: 'Live class hours are 12–16 hours per week (weekday batch: 2 hours daily on weekdays + assignments; weekend batch: 8 hours on Saturday + assignments). Assignments take an additional 3–5 hours. We recommend treating this like a serious part-time commitment.',
  },
  {
    question: 'What will I be able to build by the end?',
    answer: 'A working AI-powered application deployed live on the internet with a link you can share. Specifically: a Python automation script, a ChatGPT API chatbot, and a personal AI tool of your choice deployed on Streamlit. Actual applications, not homework exercises.',
  },
  {
    question: 'Is this a stepping stone to the longer programs?',
    answer: 'Yes — many Bootcamp graduates go on to join the AI Full Stack or GenAI Builder programs. Your Bootcamp fee is credited as ₹3,000 off the next program fee if you enroll within 3 months of completing the Bootcamp.',
  },
  {
    question: 'Is the ChatGPT API free to use?',
    answer: 'OpenAI\'s API charges per use, but costs for the bootcamp volume are minimal — typically ₹100–₹300 total for the entire 8 weeks. We guide you through setting up billing alerts so you never overspend. Most students find the cost negligible relative to what they learn.',
  },
  {
    question: 'Do I get a certificate?',
    answer: 'Yes — a LearnSynaptic completion certificate. More importantly, you get a GitHub repository and a live Streamlit link for your capstone project. In our experience, these matter far more to employers and clients than the certificate alone.',
  },
  {
    question: 'What if I fall behind during the 8 weeks?',
    answer: 'Every session is recorded and uploaded within 4 hours. You can catch up on your own time and still participate in the final project week. Mentors are available during office hours (Mon/Wed/Fri evenings) for 1-on-1 help if you get stuck.',
  },
];

const batches = [
  { date: 'July 7, 2025', type: 'Weekday Batch', time: 'Mon–Fri, 7–9 PM IST', seats: 12 },
  { date: 'August 18, 2025', type: 'Weekend Batch', time: 'Saturdays, 10 AM–6 PM IST', seats: 20 },
  { date: 'September 29, 2025', type: 'Weekend Batch', time: 'Saturdays, 10 AM–6 PM IST', seats: 25 },
];

export default function BootcampPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-20" style={{ background: 'var(--ls-hero-bg)' }}>
        <div className="ls-container">
          <AnimateOnScroll>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="ls-badge"><Clock size={12} /> 8 Weeks</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                No Coding Experience Required
              </span>
            </div>
            <h1 className="mb-4" style={{ maxWidth: 800 }}>AI Beginner Bootcamp</h1>
            <p className="text-xl mb-6" style={{ color: 'var(--ls-muted)', maxWidth: 620, lineHeight: 1.65 }}>
              Zero to building with AI in 8 weeks. Python, prompt engineering, the ChatGPT API, and
              no-code automation — even if you have never written a line of code in your life.
            </p>
            <div className="flex flex-wrap gap-6 mb-8">
              {[
                { label: 'Duration', value: '8 Weeks', Icon: Clock },
                { label: 'Next Batch', value: 'Jul 7, 2025', Icon: Calendar },
                { label: 'Seats Left', value: '12 seats', Icon: Users },
                { label: 'Price', value: '₹12,999', Icon: Star },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={15} style={{ color: 'var(--ls-blue-primary)' }} />
                  <span className="text-sm" style={{ color: 'var(--ls-muted)' }}>{label}: </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--ls-text)' }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/contact" className="ls-btn-primary">Apply for This Bootcamp <ArrowRight size={16} /></Link>
              <Link href="#curriculum" className="ls-btn-outline">View Curriculum</Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Overview (asymmetric) ─────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <AnimateOnScroll>
                <h2 className="mb-4">The fastest way to start building with AI</h2>
                <div className="space-y-4 text-base" style={{ color: 'var(--ls-muted)', maxWidth: 640 }}>
                  <p>
                    Most people who want to work with AI spend months watching YouTube tutorials and
                    finish knowing a little about a lot, able to build nothing. This bootcamp takes
                    the opposite approach: week 1 you write Python, week 4 you call the ChatGPT API,
                    week 8 you demo a working app to your cohort.
                  </p>
                  <p>
                    We have run this bootcamp 12 times. The students who get the most out of it are
                    not necessarily the smartest — they are the ones who show up consistently and
                    are willing to be confused for 20 minutes before the breakthrough arrives. That
                    experience of working through confusion is something you cannot get from a video.
                  </p>
                </div>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { title: 'Who this is for', items: ['Complete beginners with zero coding experience', 'Non-CS professionals who want to use AI at work', 'Students wanting to explore AI before committing to a full program'] },
                    { title: 'What you\'ll gain', items: ['Ability to build and deploy a working AI app', 'Python foundations that transfer to any program', 'Confidence in talking to and about AI tools professionally'] },
                    { title: 'What comes next', items: ['Upgrade to AI Full Stack Dev + DevOps', 'Move into GenAI Builder → Freelancer', 'Use AI skills directly in your current role'] },
                  ].map(({ title, items }) => (
                    <div key={title}>
                      <p className="font-semibold text-sm mb-2" style={{ color: 'var(--ls-text)' }}>{title}</p>
                      <ul className="space-y-1.5">
                        {items.map((item) => (
                          <li key={item} className="flex items-start gap-1.5 text-xs">
                            <CheckCircle2 size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--ls-blue-primary)' }} />
                            <span style={{ color: 'var(--ls-muted)' }}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </AnimateOnScroll>
            </div>
            <AnimateOnScroll delay={0.1} className="lg:col-span-1">
              <div className="rounded-2xl border p-6 sticky top-28" style={{ borderColor: 'var(--ls-border)', background: 'var(--ls-bg-alt)' }}>
                <h3 className="mb-5" style={{ fontSize: '1rem', fontWeight: 700 }}>Bootcamp at a glance</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Duration', value: '8 Weeks' },
                    { label: 'Batch size', value: 'Max 40 students' },
                    { label: 'Format', value: 'Live + Recorded' },
                    { label: 'Projects', value: '3 real projects' },
                    { label: 'Level', value: 'Complete Beginner' },
                    { label: 'Certificate', value: 'Yes, on completion' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--ls-muted)' }}>{label}</span>
                      <span className="font-semibold" style={{ color: 'var(--ls-text)' }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--ls-border)' }}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold" style={{ color: 'var(--ls-text)' }}>₹12,999</span>
                    <span className="text-sm" style={{ color: 'var(--ls-muted)' }}>total</span>
                  </div>
                  <p className="text-xs mb-4" style={{ color: 'var(--ls-muted)' }}>or ₹1,444/month × 9 (0% EMI)</p>
                  <Link href="/contact" className="ls-btn-primary w-full justify-center text-sm">
                    Join July 7 Batch
                  </Link>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* ── Projects ─────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">3 Real Projects You&apos;ll Build</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              By the end of the 8 weeks you have built three actual things — not exercises, not tutorials.
              Your capstone is deployed live with a link you can share.
            </p>
          </AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <StaggerItem key={proj.num}>
                <div className="bg-white rounded-2xl border p-6 h-full" style={{ borderColor: 'var(--ls-border)' }}>
                  <span className="text-4xl font-black block mb-3" style={{ color: 'var(--ls-blue-tint)', lineHeight: 1 }}>{proj.num}</span>
                  <h3 className="mb-2" style={{ fontSize: '1rem', fontWeight: 700 }}>{proj.title}</h3>
                  <p className="text-xs font-medium mb-3 px-2 py-1 rounded-md inline-block" style={{ background: 'var(--ls-blue-tint)', color: 'var(--ls-blue-primary)' }}>{proj.stack}</p>
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
            <h2 className="mb-3">Full Curriculum — 6 Modules, 8 Weeks</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              A tight, no-filler curriculum. Every hour is either building something or understanding how to build something better.
            </p>
          </AnimateOnScroll>
          <AnimateOnScroll><CurriculumAccordion modules={curriculum} /></AnimateOnScroll>
        </div>
      </section>

      {/* ── Tools ────────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8"><h2 className="mb-3">Tools You&apos;ll Use</h2></AnimateOnScroll>
          {['Core', 'AI', 'App Building', 'Automation', 'Productivity', 'Deployment'].map((cat) => (
            <AnimateOnScroll key={cat} className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ls-muted)' }}>{cat}</p>
              <div className="flex flex-wrap gap-2">
                {tools.filter((t) => t.cat === cat).map((t) => (
                  <span key={t.name} className="text-sm font-medium px-3.5 py-2 rounded-xl border bg-white" style={{ borderColor: 'var(--ls-border)', color: 'var(--ls-text)' }}>{t.name}</span>
                ))}
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* ── Batch Dates ──────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8"><h2 className="mb-3">Upcoming Batches</h2></AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {batches.map((b) => (
              <StaggerItem key={b.date}>
                <div className="rounded-2xl border p-5" style={{ borderColor: b.seats <= 15 ? 'var(--ls-blue-primary)' : 'var(--ls-border)', background: b.seats <= 15 ? 'var(--ls-blue-tint)' : 'white' }}>
                  {b.seats <= 15 && <span className="text-xs font-semibold mb-2 inline-block" style={{ color: 'var(--ls-blue-primary)' }}>FILLING FAST</span>}
                  <p className="font-bold text-lg mb-1" style={{ color: 'var(--ls-text)' }}>{b.date}</p>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ls-text)' }}>{b.type}</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--ls-muted)' }}>{b.time}</p>
                  <p className="text-xs font-medium" style={{ color: b.seats <= 15 ? '#dc2626' : 'var(--ls-muted)' }}>{b.seats} seats remaining</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8"><h2 className="mb-3">Pricing & Payment</h2></AnimateOnScroll>
          <AnimateOnScroll>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border p-8 bg-white" style={{ borderColor: 'var(--ls-border)' }}>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl font-black" style={{ color: 'var(--ls-text)' }}>₹12,999</span>
                  <span style={{ color: 'var(--ls-muted)' }}>total bootcamp fee</span>
                </div>
                <p className="text-sm mb-6" style={{ color: 'var(--ls-muted)' }}>
                  Or 9 monthly installments of <strong style={{ color: 'var(--ls-text)' }}>₹1,444/month</strong> at 0% interest.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    '80+ hours of live instruction over 8 weeks',
                    '3 real projects with mentor review',
                    'Access to cohort Slack for peer support',
                    '6 months access to recorded sessions',
                    'LearnSynaptic completion certificate',
                    '₹3,000 credit towards next LearnSynaptic program',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ls-success)' }} />
                      <span style={{ color: 'var(--ls-text)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/contact" className="ls-btn-primary w-full justify-center">Join the July 7 Batch <ArrowRight size={15} /></Link>
              </div>
              <div
                className="rounded-2xl p-6 flex flex-col justify-center"
                style={{ background: 'var(--ls-blue-tint)', border: '1px solid var(--ls-blue-primary)' }}
              >
                <Layers size={28} className="mb-4" style={{ color: 'var(--ls-blue-primary)' }} />
                <h3 className="mb-2" style={{ fontSize: '1.1rem', fontWeight: 700 }}>The upgrade path</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--ls-muted)', lineHeight: 1.7 }}>
                  The Bootcamp is designed as a gateway. After completing it, you get <strong style={{ color: 'var(--ls-text)' }}>₹3,000 off</strong> any
                  longer program — the AI Full Stack Dev + DevOps, GenAI Builder, or Data Science tracks.
                  Many of our best Full Stack students started here.
                </p>
                <Link href="/programs" className="text-sm font-semibold inline-flex items-center gap-1" style={{ color: 'var(--ls-blue-primary)' }}>
                  See longer programs <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10"><h2 className="mb-3">From our Bootcamp graduates</h2></AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <div className="bg-white rounded-2xl border p-6 h-full flex flex-col" style={{ borderColor: 'var(--ls-border)' }}>
                  <Quote size={20} className="mb-4" style={{ color: 'var(--ls-blue-tint)' }} />
                  <p className="text-sm leading-relaxed flex-1 mb-5" style={{ color: 'var(--ls-text)' }}>&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--ls-border)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'var(--ls-blue-primary)' }}>{t.initials}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--ls-text)' }}>{t.name}</p>
                      <p className="text-xs" style={{ color: 'var(--ls-muted)' }}>{t.role}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ background: '#dcfce7', color: 'var(--ls-success)' }}>{t.badge}</span>
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
              <p style={{ color: 'var(--ls-muted)' }}>Anything not answered here? We reply within 2 hours on weekdays.</p>
              <Link href="/contact" className="ls-btn-outline mt-6 inline-flex">Ask a question <ArrowRight size={14} /></Link>
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
              July 7 batch. 8 weeks. Your first AI app goes live.
            </h2>
            <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 480, margin: '0 auto 2rem' }}>
              At ₹12,999 this is the most accessible way to start a career in tech. Seats go quickly — especially for the weekday batch.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/contact" className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 transition-transform" style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}>
                Join the July 7 Batch <ArrowRight size={16} />
              </Link>
              <Link href="/programs" className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl border-2 hover:-translate-y-0.5 transition-transform" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', fontSize: '0.9375rem' }}>
                Compare All Programs
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
