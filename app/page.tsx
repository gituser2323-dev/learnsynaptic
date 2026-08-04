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
import { MeetTheTeam } from '@/components/MeetTheTeam';
import { HomepageVideoTeaser } from '@/components/HomepageVideoTeaser';
import { CompetitiveComparisonTable } from '@/components/ProgramComparisonTable';
import Image from 'next/image';

const currentMonth = new Date().toLocaleString("en-US", {
  month: "long",
});

const heading = `${currentMonth} Admissions Are Now Open`;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
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
  { value: '3200+', label: 'Students Trained', Icon: Users },
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

const testimonials =[
  {
    "name": "Sumit Matale",
    "role": "GenAI Builder Program",
    "quote": "Honestly one of the best learning experiences I've had. Pratik sir explains even difficult topics in a very simple way and always encourages us to build instead of just watching.",
    "badge": "★★★★",
    "initials": "SM"
  },
   {
    "type": "whatsapp",
    "name": "Aditi CI",
    "role": "Data Science • CI Batch 22",
    "quote": "I thought Python would be difficult 😅\nNow I'm actually looking forward to every class and really happy I joined this batch bcoz every class gives something new to build and practice.",
    "badge": "Thu • 6:31 PM",
    "initials": "AP"
  },
  {
    "name": "Chetana Alekar",
    "role": "AI Full Stack Program",
    "quote": "Very supportive mentors and a friendly environment. I never felt hesitant to ask questions, even basic ones. Every doubt was cleared patiently.",
    "badge": "★★★★★",
    "initials": "CA"
  },
  {
    "name": "Akash Karle",
    "role": "GenAI Program",
    "quote": "The best thing about LearnSynaptic is that everything is practical. We actually built projects instead of just reading notes.",
    "badge": "★★★★",
    "initials": "AK"
  },

  {
    "type": "whatsapp",
    "name": "Swaraj Suryawanshi",
    "role": "AI Full Stack Program",
    "quote": "Pratik sir,\nMock interview helped a lot 😅\nThe interviewer literally asked React questions we practiced.",
    "badge": "Yesterday • 8:56 PM",
    "initials": "SW"
  },

  
  {
      "type": "whatsapp",
    "name": "Swapnali CI Batch",
    "role": "CI Batch 22",
    "quote": "Sir,\nCompleted today's AI chatbot.\nIt's actually responding correctly now 😂",
    "badge": "Tue • 9:03 PM",
    "initials": "SA"
  },
  
  {
    "name": "Rutik",
    "role": "Data Analytics",
    "quote": "Pratik sir's teaching style is completely different. He explains why we write code, not just what to type. Highly recommended.",
    "badge": "★★★★",
    "initials": "R"
  },
  {
    "name": "Sanket Rajput",
    "role": "AI Full Stack Program",
    "quote": "I joined with almost zero confidence. After a few weeks I was building projects on my own. The improvement surprised even me.",
    "badge": "★★★★",
    "initials": "SR"
  },

   {
    "type": "whatsapp",
    "name": "Kavya",
    "role": "CI Batch 22",
    "quote": "Never thought coding would become this interesting 😄\nLooking forward to tomorrow's session.",
    "badge": "Mon • 04:07 PM",
    "initials": "C"
  },
     {
    "type": "whatsapp",
    "name": "Kalpesh",
    "role": "Full Stack AI Program",
    "quote": "Sir got selected ❤️\nJoining next Monday.\nThank you for all the guidance 🙏",
    "badge": "Jan 25 • 6:08 PM",
    "initials": "KC"
  },
  {
    "name": "Neelam",
    "role": "Data Analytics",
    "quote": "The classes are interactive and practical. Every session adds something useful instead of repeating theory.",
    "badge": "★★★★",
    "initials": "N"
  },
  {
    "type": "whatsapp",
    "name": "Shree AI Batch",
    "role": "AI Batch 26",
    "quote": "Honestly sir,\nThis doesn't feel like a normal institute.\nFeels more like working with a development team.",
    "badge": "Tue • 8:46 PM",
    "initials": "SP"
  },
  {
    "name": "Snehal Modhale",
    "role": "Full Stack Development",
    "quote": "Really liked the project reviews. We got proper feedback on what to improve instead of just hearing 'good job'.",
    "badge": "★★★★★",
    "initials": "SM"
  },
  {
    "name": "Sneha",
    "role": "Data Analytics",
    "quote": "Everything is explained step by step with real examples. It made learning much less stressful than I expected.",
    "badge": "★★★★★",
    "initials": "S"
  },
  {
    "name": "Akash Patil",
    "role": "GenAI Program",
    "quote": "The AI tools and projects are very up to date. I was able to build things that I had only seen on YouTube before.",
    "badge": "★★★★",
    "initials": "AP"
  },
  {
    "name": "Apurva",
    "role": "Data Science Program",
    "quote": "Every class feels engaging. The mentors keep everyone involved and the assignments actually help you learn.",
    "badge": "★★★★",
    "initials": "A"
  },
   {
    "type": "whatsapp",
    "name": "Sneha Full Stack CI",
    "role": "AI Full Stack Program",
    "quote": "Good night sir 😄\nJust wanted to say thanks.\nNever thought coding would become this interesting.",
    "badge": "03:04 PM",
    "initials": "CA"
  },
  {
    "name": "Pratik Parde",
    "role": "AI Full Stack Program",
    "quote": "Joining LearnSynaptic was one of my best decisions. The roadmap is clear and the mentors genuinely care about your progress.",
    "badge": "★★★★★",
    "initials": "PP"
  },

 
  

]

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
     <section
  className="
  relative
  overflow-hidden
  bg-gradient-to-br
  from-[#165DFC]
  via-[#1456F2]
  to-[#0E46D5]
  py-28
"
>
  {/* Background Glow */}
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-blue-300/20 blur-[140px]" />
    <div className="absolute right-0 bottom-0 h-[28rem] w-[28rem] rounded-full
bg-gradient-to-br
from-[#165DFC]
via-[#1457F0]
to-[#0D47D9]
" />
  </div>

  <div className="relative mx-auto max-w-7xl px-6">

    {/* Section Heading */}
    <div className="mb-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{color:"white"}}>
        WHY LEARN SYNAPTIC
      </p>

      <h2 className="mt-4 text-5xl text-white" style={{color:"white"}}>
        Results That Speak For Themselves
      </h2>

      <p className="mx-auto mt-5 max-w-2xl text-lg text-white" style={{color:"white"}}>
        Thousands of learners have launched successful careers through
        industry-led training, real-world projects, internships, and
        dedicated placement support.
      </p>
    </div>
  
          <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {stats.map(({ value, label, Icon, green }) => (
              <StaggerItem key={label}>
                <StatCard value={value} label={label} Icon={Icon} green={green} />
              </StaggerItem>
            ))}
          </StaggerContainer>

          
        </div>
      </section>

      {/* ── 2b. Video Testimonial Teaser ─────────────────────────────────── */}
      <HomepageVideoTeaser />

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
                        className="ls-btn-primary flex-1 justify-center  text-sm py-2"
                      >
                        Explore 
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

      {/* ── 3b. Program Comparison Table ─────────────────────────────────── */}
      <CompetitiveComparisonTable />


      {/* ── 3c. Life at LearnSynaptic Gallery Strip ──────────────────────── */}
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
              <span className="ls-badge mb-5 inline-flex">From the co-founder</span>
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
                   Co-Founder &amp; Lead Trainer, LearnSynaptic · Pune, Maharashtra
                  </p>
                </div>
              </div>
            
            </AnimateOnScroll>

            {/* Photo placeholder — right column */}
         <AnimateOnScroll
  className="lg:col-span-2 flex justify-center lg:justify-end"
  delay={0.15}
>
  <div className="relative group">

    {/* Glow */}
    <div className="absolute -inset-6 rounded-[40px] bg-blue-500/10 blur-3xl transition duration-500 group-hover:bg-blue-500/20" />

    {/* Card */}
    <div
      className="
      relative
      overflow-hidden
      rounded-[32px]
      border
      border-slate-200
      bg-white
      shadow-[0_30px_80px_rgba(15,23,42,.10)]
      transition-all
      duration-500
      group-hover:-translate-y-2
      group-hover:shadow-[0_40px_100px_rgba(22,93,252,.18)]
    "
    >
      {/* Image */}
      <div className="relative h-[420px] w-[320px]">

        <Image
          src="/learn.jpeg" // <-- replace with your image
          alt="Pratik Sabale"
          fill
          priority
          className="
          object-cover
          transition-transform
          duration-700
          group-hover:scale-105
        "
        />

        {/* Gradient Overlay */}

        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/40 to-transparent" />

        {/* Name */}

        <div className="absolute bottom-8 left-8">

          <p className="text-3xl font-white" style={{color:"white"}}>
            Pratik Sabale
          </p>

          <p className="mt-1 text-sm text-white/80"  style={{color:"white"}}>
            Co-Founder & SDE
          </p>

        </div>

      </div>

      {/* Floating Badge */}

      <div
        className="
        absolute
        top-5
        right-5
        rounded-2xl
        bg-white/90
        backdrop-blur-xl
        px-4
        py-3
        shadow-xl
      "
      >

        <p className="text-2xl font-black text-[#165DFC]">
          6+
        </p>

        <p className="text-xs text-slate-500">
          Years Experience
        </p>

      </div>

    </div>

  </div>
</AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* ── 5b. Meet the Team ────────────────────────────────────────────── */}
      {/* <MeetTheTeam /> */}

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
                    75%
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


<section className="relative overflow-hidden bg-white py-24 lg:py-36">

  {/* Background Glow */}

  <div className="absolute inset-0 -z-10">

    <div className="absolute left-1/2 top-36 h-[650px] w-[650px] -translate-x-1/2 rounded-full bg-blue-500/5 blur-[120px]" />

    <div className="absolute left-1/2 top-52 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[90px]" />

  </div>

  <div className="ls-container">

    <AnimateOnScroll>

      <div className="mx-auto max-w-6xl text-center">

        {/* Badge */}

        <span
          className="
          inline-flex
          items-center
          gap-2
          rounded-full
          border
          border-blue-100
          bg-blue-50
          px-5
          py-2.5
          text-sm
          font-semibold
          text-[#165DFC]
        "
        >
          🚀 {currentMonth} Admissions Open • Limited Seats
        </span>

        {/* Heading — h2, not h1: HeroSection.tsx (rendered first on this
            page) already has the page's one true h1; a second h1 here
            broke both "one h1 per page" and, downstream, the footer's
            heading order (h1 → h3 skips h2, flagged by Lighthouse).
            Same classes, so this renders visually identical — still the
            largest, boldest heading on the page (Module 10 performance
            audit). */}

        <h2
          className="
          mx-auto
          mt-8
          max-w-6xl

          text-[42px]
          font-black
          leading-[0.95]
          tracking-[-0.05em]

          sm:text-[56px]

          md:text-[72px]

          lg:text-[96px]

          xl:text-[110px]
        "
        >
          Six Months
          <br />

          <span className="text-slate-900">
            From Today,
          </span>

          <span className="mt-2 bg-gradient-to-r from-[#165DFC] via-blue-500 to-cyan-500 bg-clip-text text-transparent">

            You'll Thank Yourself.

          </span>

        </h2>

        {/* Subtitle */}

        <p
          className="
          mx-auto
          mt-8
          max-w-3xl

          text-base
          leading-8
          text-slate-600

          sm:text-lg

          lg:text-xl
        "
        >
          Every successful tech career begins with one decision.
          Learn from experienced mentors, build production-ready projects,
          prepare for real interviews and become the developer companies
          want to hire.
        </p>

        {/* Features */}

        <div
          className="
          mt-12

          flex

          flex-wrap

          justify-center

          gap-3
        "
        >

          {[
            "🚀 Live Classes",
            "💼 Industry Projects",
            "🎯 Mock Interviews",
            "🤝 Real Mentorship",
            "💬 Internship"
          ].map((item) => (

            <div
              key={item}
              className="
              rounded-full
              border
              border-slate-200
              bg-white
              px-5
              py-3
              text-sm
              font-medium
              shadow-sm
            "
            >
              {item}
            </div>

          ))}

        </div>

        {/* Buttons */}

        <div
          className="
          mt-14

          flex

          flex-col

          items-center

          justify-center

          gap-4

          sm:flex-row
        "
        >

          <Link
            href="/programs"
            className="
            inline-flex
            h-14
            items-center
            justify-center
            gap-2
            rounded-2xl
            bg-[#165DFC]
            px-8
            text-base
            font-semibold
            text-white
            shadow-lg
            shadow-blue-500/20
            transition-all
            duration-300
            hover:-translate-y-1
            hover:shadow-blue-500/40
          "
          >
            Explore Learning Paths

            <ArrowRight size={18} />

          </Link>

          <Link
            href="/contact"
            className="
            inline-flex
            h-14
            items-center
            justify-center
            rounded-2xl
            border
            border-slate-200
            bg-white
            px-8
            text-base
            font-semibold
            text-slate-900
            transition-all
            duration-300
            hover:border-[#165DFC]
            hover:text-[#165DFC]
          "
          >
            Book Free Career Strategy Call
          </Link>

        </div>

        {/* Bottom Line */}

        <p className="mt-8 text-sm text-slate-500">
          The best investment you can make is in yourself.
        </p>

      </div>

    </AnimateOnScroll>

  </div>

</section>
    </>
  );
}
