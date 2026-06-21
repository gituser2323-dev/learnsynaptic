import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Clock, Calendar, Users, CheckCircle2, Star, Brain, Quote,
} from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';
import { CurriculumAccordion } from '@/components/CurriculumAccordion';
import { ProgramFAQ } from '@/components/ProgramFAQ';

export const metadata: Metadata = {
  title: 'GenAI Builder → Freelancer Program — 3 Months | LearnSynaptic',
  description:
    'Build LangChain apps, RAG systems, and AI chatbots — then launch your freelancing career. 3-month intensive GenAI program from LearnSynaptic. Pune-based, pan-India batches.',
  keywords: ['genai course India', 'langchain training', 'AI freelancer course', 'generative AI program Pune'],
};

const curriculum = [
  {
    title: 'Python Foundations for AI',
    duration: '2 weeks',
    description:
      'A fast, AI-focused Python primer. We skip the computer-science theory and go directly to what you need to work with LLM APIs and AI frameworks in production.',
    topics: [
      'Variables, loops, functions — the essentials fast',
      'Working with APIs in Python using httpx and requests',
      'Data structures: lists, dicts, and when to use each',
      'Virtual environments, pip, and managing packages',
      'Parsing and manipulating JSON responses from LLM APIs',
    ],
  },
  {
    title: 'Prompt Engineering Mastery',
    duration: '2 weeks',
    description:
      'Prompt engineering is a craft. This module goes well beyond "write better prompts" — you will learn systematic frameworks used by AI engineers at top companies.',
    topics: [
      'System prompts vs user prompts — structure and strategy',
      'Zero-shot, few-shot, and chain-of-thought prompting',
      'Prompt templates and reusable prompt libraries',
      'Evaluation: how to measure prompt quality at scale',
      'Avoiding hallucinations and common failure modes',
    ],
  },
  {
    title: 'LangChain & AI Agents',
    duration: '3 weeks',
    description:
      'LangChain is the most widely-used AI framework in production. You will build chains, agents with tools, and multi-step workflows that go far beyond simple chatbots.',
    topics: [
      'LangChain chains and the LCEL (LangChain Expression Language)',
      'Building AI agents that use tools (search, calculators, APIs)',
      'Multi-agent orchestration with LangGraph',
      'Conversation memory: BufferMemory, SummaryMemory',
      'Streaming responses and async LangChain patterns',
    ],
  },
  {
    title: 'RAG Systems — Retrieval-Augmented Generation',
    duration: '2 weeks',
    description:
      'RAG is the most in-demand GenAI skill right now. Companies pay ₹3–8L/year for engineers who can build reliable RAG pipelines. This module is a complete RAG engineering course.',
    topics: [
      'How vector embeddings work (visual + practical)',
      'ChromaDB and Pinecone for production vector storage',
      'Document chunking strategies and their trade-offs',
      'Hybrid search: semantic + keyword (BM25)',
      'Evaluating RAG quality: faithfulness, relevance, recall',
    ],
  },
  {
    title: 'Building AI Applications with Streamlit & FastAPI',
    duration: '2 weeks',
    description:
      'Turn your AI logic into usable products. Streamlit for fast prototyping and client demos, FastAPI for production-ready API backends that clients can integrate into their systems.',
    topics: [
      'Streamlit: building interactive AI apps in hours not days',
      'FastAPI: async endpoints, request validation with Pydantic',
      'Deploying Streamlit apps on Hugging Face Spaces',
      'Building chatbot UIs with session state management',
      'Cost management: tracking and capping API spend',
    ],
  },
  {
    title: 'Freelancing & Client Acquisition',
    duration: '1 week',
    description:
      'The module most AI courses skip. You will learn how to find clients, write proposals that win, price your GenAI services, and build recurring income — practical business skills, not theory.',
    topics: [
      'Optimising your Upwork and LinkedIn for AI freelancing',
      'Writing proposals that win without underselling yourself',
      'Pricing GenAI projects: hourly vs fixed vs retainer',
      'Managing client expectations for AI deliverables',
      'Building a portfolio that sells before you say a word',
    ],
  },
  {
    title: 'Capstone: 3 Client-Ready Projects',
    duration: '2 weeks',
    description:
      'Build three production-grade projects under mentor review. These go directly into your portfolio and onto your Upwork profile. You will present these to a mock client panel.',
    topics: [
      'Project 1: AI chatbot with custom document knowledge base',
      'Project 2: Automated report-generation pipeline for a business use case',
      'Project 3: Your choice — built around your freelance niche',
      'GitHub documentation and Upwork portfolio setup',
      'Mock client demo and feedback session',
    ],
  },
];

const tools = [
  { name: 'Python', cat: 'Core' },
  { name: 'Jupyter Notebook', cat: 'Core' },
  { name: 'OpenAI API', cat: 'AI / LLMs' },
  { name: 'Anthropic API', cat: 'AI / LLMs' },
  { name: 'Hugging Face', cat: 'AI / LLMs' },
  { name: 'LangChain', cat: 'Frameworks' },
  { name: 'LangGraph', cat: 'Frameworks' },
  { name: 'ChromaDB', cat: 'Vector Stores' },
  { name: 'Pinecone', cat: 'Vector Stores' },
  { name: 'Streamlit', cat: 'App Building' },
  { name: 'FastAPI', cat: 'App Building' },
  { name: 'GitHub', cat: 'Deployment' },
  { name: 'Hugging Face Spaces', cat: 'Deployment' },
];

const projects = [
  {
    num: '01',
    title: 'AI Chatbot with Custom Knowledge Base',
    stack: 'LangChain, Pinecone, Streamlit',
    description: 'A production chatbot trained on any set of PDFs, docs, or websites the client specifies. Includes source citations, session memory, and a clean Streamlit interface ready for client delivery.',
  },
  {
    num: '02',
    title: 'RAG-Powered Document Q&A System',
    stack: 'LangChain, ChromaDB, FastAPI',
    description: 'An API-first document intelligence system. Upload any PDF collection and query it with natural language. Built on FastAPI for seamless client integration into existing systems.',
  },
  {
    num: '03',
    title: 'Your Freelance Niche Project',
    stack: 'Your choice of stack',
    description: 'The third project is yours to define around your chosen freelance niche — marketing automation, legal document review, HR screening, content generation. Mentors help you scope it for maximum client appeal.',
  },
];

const testimonials = [
  {
    name: 'Aditya Patil',
    role: 'Final Year Engineering Student → Freelance GenAI Developer',
    quote: 'I started getting freelance clients before completing the program. The RAG module and the freelancing module together are genuinely worth the full fee. My first client paid me ₹35,000 for a chatbot I built in week 10.',
    badge: '₹55K/month Freelance',
    initials: 'AP',
  },
  {
    name: 'Meera Joshi',
    role: 'Content Writer → AI Consultant (Upwork Top Rated)',
    quote: 'Non-engineering background here. The Python module is designed for people exactly like me. By month 2, I had a working LangChain app. By month 3, I had 3 Upwork clients. No other course does this.',
    badge: 'Top Rated on Upwork',
    initials: 'MJ',
  },
];

const faqs = [
  {
    question: 'Do I need a programming background to join?',
    answer: 'Not a strong one. The program starts with a 2-week Python module specifically designed for people with minimal coding experience. If you can use a computer confidently and understand basic logic, you are ready. We recommend the AI Beginner Bootcamp only if you have never written any code at all.',
  },
  {
    question: 'How much can I realistically earn freelancing after this program?',
    answer: 'Realistic ranges: ₹20,000–₹50,000/month within 3–6 months of active freelancing for new freelancers. Experienced professionals with prior domain expertise (legal, finance, marketing) often earn ₹60,000–₹1,20,000/month faster because they have a built-in client niche.',
  },
  {
    question: 'Is this program suitable for working professionals?',
    answer: 'Yes — we offer weekend batches specifically for this reason. The Saturday–Sunday batch covers the full curriculum over 3 months (6 hours per day on weekends). The weekday batch runs 4 hours per evening Monday–Friday.',
  },
  {
    question: 'What is the difference between this program and a basic Python/AI course on Udemy?',
    answer: 'Three things self-paced courses never deliver: real-time mentor feedback on your code and projects, a freelance acquisition module that actually teaches you to find clients, and the accountability of a live cohort. Most people who buy a Udemy course finish 30% of it. Our completion rate is over 90%.',
  },
  {
    question: 'Do you cover OpenAI alternatives like Google Gemini or Anthropic?',
    answer: 'Yes. The program is API-agnostic. We cover OpenAI in depth because it is the industry standard, but we also teach Anthropic Claude and Hugging Face open-source models. The skills transfer directly — once you can use LangChain, the underlying model is swappable.',
  },
  {
    question: 'What if I cannot find freelance clients after completing the program?',
    answer: 'Our placement team actively helps with Upwork profile reviews, LinkedIn audits, and warm introductions to companies in our network who hire freelancers. We also have a dedicated Slack channel where alumni share project opportunities with each other.',
  },
  {
    question: 'Will I get a certificate?',
    answer: 'Yes — a LearnSynaptic completion certificate, plus documented GitHub repositories for all 3 projects. These matter more to clients than any certificate — a working chatbot on your profile closes more deals than a PDF.',
  },
];

const batches = [
  { date: 'August 5, 2026', type: 'Weekday Batch', time: 'Mon–Fri, 7–11 PM IST', seats: 8 },
  { date: 'September 15, 2026', type: 'Weekend Batch', time: 'Sat–Sun, 10 AM–4 PM IST', seats: 15 },
  { date: 'November 10, 2026', type: 'Weekend Batch', time: 'Sat–Sun, 10 AM–4 PM IST', seats: 20 },
];

export default function GenAIBuilderPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-20" style={{ background: 'var(--ls-hero-bg)' }}>
        <div className="ls-container">
          <AnimateOnScroll>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="ls-badge"><Clock size={12} /> 3 Months</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#fef9c3', color: '#854d0e' }}>
                High Demand — Fastest-Growing Track
              </span>
            </div>
            <h1 className="mb-4" style={{ maxWidth: 800 }}>GenAI Builder → Freelancer Program</h1>
            <p className="text-xl mb-6" style={{ color: 'var(--ls-muted)', maxWidth: 620, lineHeight: 1.65 }}>
              Learn to build production-ready GenAI applications — chatbots, RAG systems, AI agents —
              and launch your freelancing career with real client projects in hand before you graduate.
            </p>
            <div className="flex flex-wrap gap-6 mb-8">
              {[
                { label: 'Duration', value: '3 Months', Icon: Clock },
                { label: 'Next Batch', value: 'Aug 5, 2026', Icon: Calendar },
                { label: 'Price', value: '₹29,999', Icon: Star },
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
                Apply for This Program <ArrowRight size={16} />
              </Link>
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
                <h2 className="mb-4">Why this program exists</h2>
                <div className="space-y-4 text-base" style={{ color: 'var(--ls-muted)', maxWidth: 640 }}>
                  <p>
                    GenAI skills are in enormous demand right now — but most courses stop at teaching you the tools.
                    They don&apos;t teach you how to find clients, write proposals, price your work, or build recurring income.
                    This program does both: the technical depth to build real GenAI products and the business skills to sell them.
                  </p>
                  <p>
                    By graduation, you have 3 deployed projects, a client-ready Upwork and LinkedIn profile, and
                    the practical experience of presenting AI work to a mock client panel. Most of our freelancing
                    graduates land their first paid client within 60 days of starting the program — sometimes before.
                  </p>
                </div>
              </AnimateOnScroll>
            </div>
            <AnimateOnScroll delay={0.1} className="lg:col-span-1">
              <div className="rounded-2xl border p-6 sticky top-28" style={{ borderColor: 'var(--ls-border)', background: 'var(--ls-bg-alt)' }}>
                <h3 className="mb-5" style={{ fontSize: '1rem', fontWeight: 700 }}>Program at a glance</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Duration', value: '3 Months' },
                    { label: 'Batch size', value: 'Max 25 students' },
                    { label: 'Format', value: 'Live + Recorded' },
                    { label: 'Projects', value: '3 client-ready projects' },
                    { label: 'Level', value: 'Beginner–Intermediate' },
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
                    <span className="text-2xl font-bold" style={{ color: 'var(--ls-text)' }}>₹29,999</span>
                    <span className="text-sm" style={{ color: 'var(--ls-muted)' }}>total</span>
                  </div>
                  <p className="text-xs mb-4" style={{ color: 'var(--ls-muted)' }}>or ₹3,333/month × 9 (0% EMI)</p>
                  <Link href="/contact" className="ls-btn-primary w-full justify-center text-sm">
                    Apply for This Program
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
            <h2 className="mb-3">3 Projects That Win Clients</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              Every project is built to a client brief, reviewed by mentors, and documented for your portfolio.
              These are the projects that generate inquiries on Upwork before you actively pitch.
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
            <h2 className="mb-3">Full Curriculum — 7 Modules</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              14 weeks from Python to paying clients. Each module builds directly on the last.
            </p>
          </AnimateOnScroll>
          <AnimateOnScroll><CurriculumAccordion modules={curriculum} /></AnimateOnScroll>
        </div>
      </section>

      {/* ── Tools ────────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8">
            <h2 className="mb-3">Tools You&apos;ll Master</h2>
          </AnimateOnScroll>
          {['Core', 'AI / LLMs', 'Frameworks', 'Vector Stores', 'App Building', 'Deployment'].map((cat) => (
            <AnimateOnScroll key={cat} className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ls-muted)' }}>{cat}</p>
              <div className="flex flex-wrap gap-2">
                {tools.filter((t) => t.cat === cat).map((t) => (
                  <span key={t.name} className="text-sm font-medium px-3.5 py-2 rounded-xl border bg-white" style={{ borderColor: 'var(--ls-border)', color: 'var(--ls-text)' }}>
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
          <AnimateOnScroll className="mb-8"><h2 className="mb-3">Upcoming Batches</h2></AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {batches.map((b) => (
              <StaggerItem key={b.date}>
                <div className="rounded-2xl border p-5" style={{ borderColor: b.seats <= 10 ? 'var(--ls-blue-primary)' : 'var(--ls-border)', background: b.seats <= 10 ? 'var(--ls-blue-tint)' : 'white' }}>
                  {b.seats <= 10 && <span className="text-xs font-semibold mb-2 inline-block" style={{ color: 'var(--ls-blue-primary)' }}>FILLING FAST</span>}
                  <p className="font-bold text-lg mb-1" style={{ color: 'var(--ls-text)' }}>{b.date}</p>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ls-text)' }}>{b.type}</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--ls-muted)' }}>{b.time}</p>
                  <p className="text-xs font-medium" style={{ color: b.seats <= 10 ? '#dc2626' : 'var(--ls-muted)' }}>{b.seats} seats remaining</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8"><h2 className="mb-3">Pricing & Payment Options</h2></AnimateOnScroll>
          <AnimateOnScroll>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border p-8 bg-white" style={{ borderColor: 'var(--ls-border)' }}>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl font-black" style={{ color: 'var(--ls-text)' }}>₹29,999</span>
                  <span style={{ color: 'var(--ls-muted)' }}>total programme fee</span>
                </div>
                <p className="text-sm mb-6" style={{ color: 'var(--ls-muted)' }}>
                  Or pay in 9 equal installments of <strong style={{ color: 'var(--ls-text)' }}>₹3,333/month</strong> at 0% interest.
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    '200+ hours of live instruction',
                    '3 client-ready portfolio projects',
                    'Freelance acquisition module + profile review',
                    '6 months placement & freelance support',
                    '1-year access to recorded sessions',
                    'LearnSynaptic completion certificate',
                    'Alumni network access (Slack)',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ls-success)' }} />
                      <span style={{ color: 'var(--ls-text)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/contact" className="ls-btn-primary w-full justify-center">
                  Apply Now & Reserve Your Seat <ArrowRight size={15} />
                </Link>
              </div>
              <div className="rounded-2xl border p-6 bg-white space-y-4" style={{ borderColor: 'var(--ls-border)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>EMI Breakdown</h3>
                {[
                  { label: 'Registration fee (upfront)', value: '₹3,000', note: 'Adjusted against total' },
                  { label: 'Monthly EMI × 9', value: '₹2,999/mo', note: '0% interest via Razorpay' },
                  { label: 'Interest charge', value: '₹0', note: 'Completely interest-free' },
                ].map(({ label, value, note }) => (
                  <div key={label} className="flex items-start justify-between text-sm">
                    <div>
                      <p style={{ color: 'var(--ls-text)', fontWeight: 500 }}>{label}</p>
                      <p className="text-xs" style={{ color: 'var(--ls-muted)' }}>{note}</p>
                    </div>
                    <span className="font-bold" style={{ color: 'var(--ls-text)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10"><h2 className="mb-3">From our GenAI graduates</h2></AnimateOnScroll>
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
              <p style={{ color: 'var(--ls-muted)' }}>Questions? Our team replies within 2 hours on weekdays.</p>
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
              Join the August 5 batch — build a client-ready portfolio in 3 months.
            </h2>
            <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 480, margin: '0 auto 2rem' }}>
              3 months to a portfolio that generates client inquiries on its own.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/contact" className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 transition-transform" style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}>
                Apply for August Batch <ArrowRight size={16} />
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
