import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, TrendingUp, Users, BookOpen, Layers,
  FileText, MessageSquare, Send, Star,
} from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';

export const metadata: Metadata = {
  title: 'Placements & Hiring Outcomes — LearnSynaptic',
  description:
    '90% placement rate across 5+ batches. 200+ students trained. See LearnSynaptic graduates placed at top companies across India. Pune-based, pan-India outcomes.',
  keywords: ['LearnSynaptic placements', 'tech placements India', 'developer job placement Pune', 'AI course placement rate'],
};

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * PLACEHOLDER / DEMO DATA — ENTIRE SECTION BELOW
 * Replace all placement cards, hiring partner logos, and student photos
 * with real data before launch. Each card is marked with realistic but
 * fictional names and companies. Use initials avatar fallbacks until
 * real headshots are available.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const placementCards = [
{
  initials: 'AT',
  name: 'Atharva T',
  role: 'Frontend Developer',
  company: 'CodeNest Solutions',
  location: 'Pune',
  program: 'AI Full Stack Dev',
  package: '₹3.2 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'VK',
  name: 'Vedant K',
  role: 'Full Stack Developer',
  company: 'TechBridge Systems',
  location: 'Pune',
  program: 'AI Full Stack Dev',
  package: '₹3.5 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'SK',
  name: 'Siddhi K',
  role: 'Frontend Developer',
  company: 'ByteWave Technologies',
  location: 'Mumbai',
  program: 'AI Full Stack Dev',
  package: '₹3.0 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'TD',
  name: 'Tanmay D',
  role: 'Full Stack Intern',
  company: 'CloudPeak Solutions',
  location: 'Pune',
  program: 'AI Beginner Bootcamp',
  package: 'Internship',
  color: '#7e22ce',
},
{
  initials: 'SM',
  name: 'Shreyas M',
  role: 'Frontend Developer',
  company: 'NextOrbit Technologies',
  location: 'Pune',
  program: 'AI Full Stack Dev',
  package: '₹3.4 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'AP',
  name: 'Aarohi P',
  role: 'Frontend Intern',
  company: 'WebSpark Systems',
  location: 'Pune',
  program: 'AI Beginner Bootcamp',
  package: 'Internship',
  color: '#7e22ce',
},
{
  initials: 'RG',
  name: 'Rohit G',
  role: 'Full Stack Developer',
  company: 'DigitalNest Solutions',
  location: 'Hyderabad',
  program: 'AI Full Stack Dev',
  package: '₹3.8 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'ST',
  name: 'Sneha T',
  role: 'Frontend Developer',
  company: 'CodeFusion Labs',
  location: 'Pune',
  program: 'AI Full Stack Dev',
  package: '₹3.1 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'AB',
  name: 'Aditya B',
  role: 'Full Stack Developer',
  company: 'SoftEdge Technologies',
  location: 'Bangalore',
  program: 'AI Full Stack Dev',
  package: '₹3.7 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'PS',
  name: 'Pooja S',
  role: 'Frontend Developer',
  company: 'Innovexa Systems',
  location: 'Pune',
  program: 'AI Full Stack Dev',
  package: '₹3.2 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'HK',
  name: 'Harshal K',
  role: 'Frontend Intern',
  company: 'DevCore Solutions',
  location: 'Mumbai',
  program: 'AI Beginner Bootcamp',
  package: 'Internship',
  color: '#7e22ce',
},
{
  initials: 'NP',
  name: 'Nikita P',
  role: 'Frontend Developer',
  company: 'StackWave Technologies',
  location: 'Pune',
  program: 'AI Full Stack Dev',
  package: '₹3.3 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'OJ',
  name: 'Omkar J',
  role: 'Full Stack Developer',
  company: 'BrightCode Systems',
  location: 'Pune',
  program: 'AI Full Stack Dev',
  package: '₹3.6 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'RM',
  name: 'Rupali M',
  role: 'Frontend Developer',
  company: 'LogicBridge Solutions',
  location: 'Pune',
  program: 'AI Full Stack Dev',
  package: '₹3.1 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'SP',
  name: 'Sanket P',
  role: 'Full Stack Intern',
  company: 'TechNova Labs',
  location: 'Pune',
  program: 'AI Beginner Bootcamp',
  package: 'Internship',
  color: '#7e22ce',
},
{
  initials: 'TS',
  name: 'Tejal S',
  role: 'Frontend Developer',
  company: 'WebOrbit Technologies',
  location: 'Mumbai',
  program: 'AI Full Stack Dev',
  package: '₹3.0 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'PG',
  name: 'Prasad G',
  role: 'Full Stack Developer',
  company: 'CodeHive Systems',
  location: 'Pune',
  program: 'AI Full Stack Dev',
  package: '₹3.9 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'AK',
  name: 'Aishwarya K',
  role: 'Frontend Developer',
  company: 'SoftBridge Technologies',
  location: 'Pune',
  program: 'AI Full Stack Dev',
  package: '₹3.2 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'AP',
  name: 'Abhishek P',
  role: 'Full Stack Developer',
  company: 'CloudMatrix Solutions',
  location: 'Hyderabad',
  program: 'AI Full Stack Dev',
  package: '₹3.8 LPA',
  color: 'var(--ls-blue-primary)',
},
{
  initials: 'VD',
  name: 'Vaishnavi D',
  role: 'Frontend Intern',
  company: 'ByteCraft Technologies',
  location: 'Pune',
  program: 'AI Beginner Bootcamp',
  package: 'Internship',
  color: '#7e22ce',
},
];

/*
 * PLACEHOLDER — Hiring partner logos
 * Replace company names with actual logo <Image> components before launch.
 * Logos should be ~120×40px SVG or PNG on white/transparent background.
 */
const hiringPartners = [
  'TCS', 'Wipro', 'Infosys', 'Cognizant', 'Persistent Systems',
  'Tech Mahindra', 'HCL Technologies', 'Accenture', 'Capgemini',
  'Hexaware', 'KPMG India', 'Deloitte', 'Mphasis', 'Cyient', 'Birlasoft',
];

const processSteps = [
  {
    step: '01',
    Icon: FileText,
    title: 'Resume & LinkedIn Review',
    body: 'Our placement team reviews your resume and LinkedIn profile and provides actionable feedback. We help you document your 3 capstone projects in a way that gets recruiter attention — not just lists of technologies.',
  },
  {
    step: '02',
    Icon: MessageSquare,
    title: 'Mock Interviews',
    body: 'Two rounds of mock technical interviews — one focused on DSA and problem-solving, one on the project-specific technical depth. You get written feedback after each round so you know exactly what to improve.',
  },
  {
    step: '03',
    Icon: Send,
    title: 'Hiring Partner Introductions',
    body: 'Warm introductions to relevant hiring managers and HR contacts in our network of 60+ partner companies. We match you to companies based on your program, tech stack, and location preference.',
  },
  {
    step: '04',
    Icon: Star,
    title: '6 Months of Active Support',
    body: 'Placement support does not end at graduation. We continue active follow-ups for 6 months post-completion — new openings shared, referrals made, interview prep available on demand via our alumni Slack.',
  },
];

export default function PlacementsPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-20" style={{ background: 'var(--ls-hero-bg)' }}>
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <span className="ls-badge mb-5 inline-flex">Placement outcomes</span>
            <h1 className="mb-4">Where our graduates land</h1>
            <p
              className="text-lg"
              style={{ color: 'var(--ls-muted)', maxWidth: 540, margin: '0 auto' }}
            >
              5+ batches completed. 90% of graduates placed or actively earning within
              6 months. Here&apos;s what that looks like in practice.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '56px 0' }}>
        <div className="ls-container">
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-8 lg:gap-16 text-center">
            {[
              { value: '45+', label: 'Batches Completed', Icon: BookOpen },
              { value: '3200+', label: 'Students Trained', Icon: Users },
              { value: '70%', label: 'Placement Rate', Icon: TrendingUp, green: true },
            ].map(({ value, label, Icon, green }) => (
              <StaggerItem key={label}>
                <div className="flex flex-col items-center">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: 'rgba(255,255,255,0.15)' }}
                  >
                    <Icon size={20} color={green ? '#86efac' : '#fff'} />
                  </div>
                  <span
                    className="block text-5xl font-bold mb-1"
                    style={{ color: green ? '#86efac' : '#fff', letterSpacing: '-0.02em' }}
                  >
                    {value}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {label}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Placement Cards Grid ─────────────────────────────────────────── */}
      {/*
       * PLACEHOLDER SECTION — replace with real student data before launch.
       * Real data needed per card: student photo, name, role, company, program.
       * Use <Image> component for photos. Keep initials fallback as loading state.
       */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="mb-2">Placed graduates</h2>
                <p style={{ color: 'var(--ls-muted)', maxWidth: 460 }}>
                  A selection of students placed across programs.{' '}
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded"
                    style={{ background: '#fef9c3', color: '#854d0e' }}
                  >
                  </span>
                </p>
              </div>
              <Link href="/testimonials" className="ls-btn-outline text-sm py-2 px-4 shrink-0">
                Read full testimonials <ArrowRight size={13} />
              </Link>
            </div>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {placementCards.map((card) => (
              <StaggerItem key={card.name}>
                <div
                  className="bg-white rounded-2xl border p-5 text-center flex flex-col items-center"
                  style={{ borderColor: 'var(--ls-border)' }}
                >
                  {/*
                   * TODO: replace this avatar div with:
                   * <Image src={card.photoSrc} alt={card.name} width={72} height={72}
                   *   className="w-18 h-18 rounded-full object-cover" />
                   */}
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white mb-3"
                    style={{ background: card.color }}
                  >
                    {card.initials}
                  </div>

                  <p className="font-semibold text-sm mb-0.5" style={{ color: 'var(--ls-text)' }}>
                    {card.name}
                  </p>
                  <p className="text-xs mb-1" style={{ color: 'var(--ls-muted)' }}>
                    {card.role}
                  </p>

                  <div
                    className="text-xs font-semibold px-2.5 py-1 rounded-full mb-3"
                    style={{ background: 'var(--ls-bg-alt)', color: 'var(--ls-text)' }}
                  >
                    Placed at {card.company}
                  </div>

                  <div className="flex items-center gap-2 text-xs w-full justify-center">
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--ls-blue-tint)', color: 'var(--ls-blue-primary)', fontWeight: 600 }}
                    >
                      {card.package}
                    </span>
                    <span style={{ color: 'var(--ls-muted)' }}>· {card.location}</span>
                  </div>

                  <p className="text-xs mt-2" style={{ color: 'var(--ls-muted)' }}>
                    via {card.program}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Hiring Partners ──────────────────────────────────────────────── */}
      {/*
       * PLACEHOLDER — hiring partner logos
       * Replace company name text with actual <Image> logo components before launch.
       * Recommended logo size: 120×36px, SVG or PNG on transparent background.
       */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8">
            <h2 className="mb-3">Our graduates work at</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 480 }}>
              60+ companies across India have hired LearnSynaptic graduates.
              Below is a selection — logo placeholders to be updated before launch.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            {hiringPartners.map((company) => (
              <StaggerItem key={company}>
                {/* TODO: replace this div with <Image> company logo */}
                <div
                  className="bg-white rounded-xl border flex items-center justify-center py-4 px-3 text-center"
                  style={{ borderColor: 'var(--ls-border)', minHeight: 60 }}
                >
                  <span className="text-xs font-semibold" style={{ color: 'var(--ls-text)' }}>
                    {company}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Placement Process ─────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">How placement support works</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              Placement support is not a promise pinned to a brochure. It&apos;s a structured 4-step
              process that begins in the final month of your program and runs for 6 months after.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {processSteps.map((step) => {
              const Icon = step.Icon;
              return (
                <StaggerItem key={step.step}>
                  <div
                    className="bg-white rounded-2xl border p-6"
                    style={{ borderColor: 'var(--ls-border)' }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="shrink-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: 'var(--ls-blue-tint)' }}
                        >
                          <Icon size={18} style={{ color: 'var(--ls-blue-primary)' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className="text-xs font-bold font-mono"
                            style={{ color: 'var(--ls-blue-primary)' }}
                          >
                            Step {step.step}
                          </span>
                        </div>
                        <h3
                          className="mb-2"
                          style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ls-text)' }}
                        >
                          {step.title}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--ls-muted)' }}>
                          {step.body}
                        </p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>

          <AnimateOnScroll className="mt-8">
            <div
              className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
              style={{ background: 'var(--ls-bg-alt)', border: '1px solid var(--ls-border)' }}
            >
              <div className="flex-1">
                <p className="font-semibold mb-1" style={{ color: 'var(--ls-text)' }}>
                  A note on placement guarantees
                </p>
                <p className="text-sm" style={{ color: 'var(--ls-muted)', maxWidth: 560 }}>
                  We don&apos;t promise guaranteed placement — no honest training program should.
                  What we do promise is genuine, sustained effort: introductions, prep, and
                  ongoing follow-up until you land. Our 90% rate reflects students who engaged
                  actively with the placement process.
                </p>
              </div>
              <Link href="/contact" className="ls-btn-primary shrink-0 text-sm">
                Discuss your goals <ArrowRight size={14} />
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '88px 0' }}>
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <h2 className="mb-4" style={{ color: '#fff', maxWidth: 580, margin: '0 auto 1rem' }}>
              The next name on this page could be yours.
            </h2>
            <p
              className="text-lg mb-8"
              style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 440, margin: '0 auto 2rem' }}
            >
              Every one of these outcomes started with a 15-minute conversation. Book one today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 transition-transform"
                style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}
              >
                Book a Free Counselling Call <ArrowRight size={16} />
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
