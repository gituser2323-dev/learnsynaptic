import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Quote } from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';

export const metadata: Metadata = {
  title: 'Student Testimonials — Real Outcomes from LearnSynaptic',
  description:
    'Read what LearnSynaptic graduates say about their career transitions. Before and after role outcomes from students across AI Full Stack, GenAI Builder, Data Science, and Bootcamp programs.',
  keywords: ['LearnSynaptic reviews', 'student testimonials India', 'tech course reviews Pune', 'AI training outcomes'],
};

/*
 * PLACEHOLDER / DEMO DATA
 * ─────────────────────────────────────────────────────────────────────────────
 * All testimonials below are placeholder entries with realistic structure.
 * Replace with real student testimonials + photos before launch.
 * Each entry is clearly marked with realistic Indian names and believable
 * role transitions tied to specific LearnSynaptic programs.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const testimonials = [
  {
    initials: 'AD',
    name: 'Arjun Deshmukh',
    before: 'Final-year BE Computer Engineering student',
    after: 'Backend Developer at a Pune startup',
    program: 'GenAI Builder → Freelancer',
    programSlug: 'genai-builder',
    quote:
      "I came in knowing JavaScript but had no idea how to use AI APIs in a real project. By week 6 of the GenAI Builder program, I had a working LangChain chatbot deployed. That project got me my first freelance client and eventually a full-time offer.",
    badge: '₹4.8 LPA Offer',
  },
  {
    initials: 'KI',
    name: 'Kavya Iyer',
    before: 'BPO data entry executive, 2 years',
    after: 'Data Analyst at Cognizant',
    program: 'Data Science AI/ML',
    programSlug: 'data-science',
    quote:
      "I had no tech background — just Excel skills and a lot of motivation. The statistics module broke everything down visually and the Power BI project is literally what I demo\'d in my Cognizant interview. They hired me on the spot.",
    badge: '2.4× Salary Increase',
  },
  {
    initials: 'RV',
    name: 'Rahul Verma',
    before: 'Unemployed BCS graduate, 8 months post-college',
    after: 'Python Developer at a Hyderabad SaaS company',
    program: 'AI Beginner Bootcamp → Full Stack Dev',
    programSlug: 'bootcamp',
    quote:
      "I tried learning on YouTube for months and barely got through beginner Python. The bootcamp cohort model is completely different — I finished all 8 weeks and upgraded to the Full Stack program. Total time: 7 months. Placed at SaaS company within 2 weeks of graduation.",
    badge: '₹5.2 LPA Package',
  },
  {
    initials: 'SP',
    name: 'Siddhi Patil',
    before: 'HR executive at a mid-size IT company',
    after: 'Junior Full Stack Developer at LeapFrog Technology',
    program: 'AI Full Stack Dev + DevOps',
    programSlug: 'full-stack-devops',
    quote:
      "Non-engineering background here. I was terrified of the DevOps modules but Pratik teaches Docker and AWS like he\'s talking to a smart friend, not a textbook. Six months later I\'m writing CI/CD pipelines at a product company. Still feels unreal.",
    badge: '₹6.5 LPA Package',
  },
  {
    initials: 'AS',
    name: 'Aakash Sharma',
    before: 'Mechanical engineering graduate, no coding background',
    after: 'MERN Stack Developer at a Delhi startup',
    program: 'AI Full Stack Dev + DevOps',
    programSlug: 'full-stack-devops',
    quote:
      "The capstone project is what got me hired. I deployed a full-stack AI-powered app on AWS and put the live URL in my resume. Every single interviewer asked about it. That\'s the whole point of this program — you leave with proof, not just knowledge.",
    badge: '₹5.8 LPA Package',
  },
  {
    initials: 'PN',
    name: 'Pooja Nair',
    before: 'Content writer, no coding experience',
    after: 'Freelance AI Developer — ₹45K/month',
    program: 'GenAI Builder → Freelancer',
    programSlug: 'genai-builder',
    quote:
      "The freelancing module in month 3 is worth the entire fee alone. I already had writing skills — GenAI Builder gave me the technical vocabulary and the first 3 projects to put on my Upwork profile. I had my first paid client before finishing the program.",
    badge: '₹45K/month Freelance',
  },
  {
    initials: 'NG',
    name: 'Nikhil Gaikwad',
    before: 'Second-year BCS student, zero practical skills',
    after: 'Junior Developer intern at Webwise Solutions, Pune',
    program: 'AI Beginner Bootcamp',
    programSlug: 'bootcamp',
    quote:
      "I\'m still in college but I have an internship now because of this bootcamp. My classmates know more theory than me. I know how to ship. When I showed my manager the Streamlit app I built in week 8, he offered me the internship the same week.",
    badge: 'Internship in Semester 4',
  },
  {
    initials: 'SK',
    name: 'Sneha Kulkarni',
    before: 'Customer support executive, 3 years experience',
    after: 'Frontend Developer at an EdTech company',
    program: 'AI Full Stack Dev + DevOps',
    programSlug: 'full-stack-devops',
    quote:
      "Three years of customer support and a growing sense that I was falling behind. I took the Full Stack program on weekends while still working my day job. The weekend batch format made it possible. Six months, two days a week, and a completely different career.",
    badge: 'Full Career Switch',
  },
  {
    initials: 'RJ',
    name: 'Rishi Joshi',
    before: 'IT fresher, 1 year into a support role at a service firm',
    after: 'AI Integration Developer at a product company',
    program: 'GenAI Builder → Freelancer',
    programSlug: 'genai-builder',
    quote:
      "I was an IT fresher in a support role going nowhere. The GenAI Builder program changed my positioning entirely — I stopped being a support engineer and became someone who could integrate AI into products. That\'s a completely different market, and a different salary band.",
    badge: '₹8.2 LPA — 3× Hike',
  },
  {
    initials: 'TB',
    name: 'Tanvi Bhat',
    before: 'MBA graduate with no tech skills, job-hunting for 5 months',
    after: 'Data Analyst at a management consultancy in Bangalore',
    program: 'Data Science AI/ML',
    programSlug: 'data-science',
    quote:
      "My MBA gave me strategy and communication skills but zero data skills. In consulting, that\'s a ceiling. The Data Science program gave me SQL, Python, and a Power BI dashboard I\'m genuinely proud of. The consultancy hired me specifically for data-driven client work.",
    badge: '₹7.1 LPA Package',
  },
];

const programColors: Record<string, { bg: string; text: string }> = {
  'genai-builder': { bg: '#fef9c3', text: '#854d0e' },
  'full-stack-devops': { bg: 'var(--ls-blue-tint)', text: 'var(--ls-blue-primary)' },
  'data-science': { bg: '#dcfce7', text: 'var(--ls-success)' },
  bootcamp: { bg: '#f3e8ff', text: '#7e22ce' },
};

export default function TestimonialsPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-20" style={{ background: 'var(--ls-hero-bg)' }}>
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <span className="ls-badge mb-5 inline-flex">Student outcomes</span>
            <h1 className="mb-4">Real students. Real career changes.</h1>
            <p
              className="text-lg"
              style={{ color: 'var(--ls-muted)', maxWidth: 540, margin: '0 auto' }}
            >
              Before role → After role. Specific programs, specific outcomes. No vague
              &ldquo;it changed my life&rdquo; quotes — just what changed, and what they built to get there.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-bg-alt)', padding: '40px 0', borderBottom: '1px solid var(--ls-border)' }}>
        <div className="ls-container">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { value: '3200+', label: 'Students trained' },
              { value: '70%', label: 'Placement rate', green: true },
              { value: '45+', label: 'Batches completed' },
            ].map(({ value, label, green }) => (
              <div key={label}>
                <p
                  className="text-3xl font-bold"
                  style={{ color: green ? 'var(--ls-success)' : 'var(--ls-text)' }}
                >
                  {value}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--ls-muted)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials wall ────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {testimonials.map((t) => {
              const colors = programColors[t.programSlug] ?? {
                bg: 'var(--ls-blue-tint)',
                text: 'var(--ls-blue-primary)',
              };
              return (
                <StaggerItem key={t.name}>
                  <div
                    className="bg-white rounded-2xl border flex flex-col h-full"
                    style={{ borderColor: 'var(--ls-border)' }}
                  >
                    {/* Program tag */}
                    <div
                      className="px-5 pt-5 pb-0"
                    >
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {t.program}
                      </span>
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      <Quote size={18} className="mb-3" style={{ color: 'var(--ls-blue-tint)' }} />
                      <p
                        className="text-sm leading-relaxed flex-1 mb-4"
                        style={{ color: 'var(--ls-text)' }}
                      >
                        &ldquo;{t.quote}&rdquo;
                      </p>

                      {/* Before → After */}
                      <div
                        className="mb-4 p-3 rounded-xl text-xs"
                        style={{ background: 'var(--ls-bg-alt)' }}
                      >
                        <p style={{ color: 'var(--ls-muted)' }}>
                          <span className="font-semibold" style={{ color: 'var(--ls-text)' }}>Before: </span>
                          {t.before}
                        </p>
                        <div className="my-1.5 flex items-center gap-1.5">
                          <div
                            className="flex-1 h-px"
                            style={{ background: 'var(--ls-border)' }}
                          />
                          <ArrowRight size={10} style={{ color: 'var(--ls-blue-primary)' }} />
                          <div
                            className="flex-1 h-px"
                            style={{ background: 'var(--ls-border)' }}
                          />
                        </div>
                        <p style={{ color: 'var(--ls-muted)' }}>
                          <span className="font-semibold" style={{ color: 'var(--ls-success)' }}>Now: </span>
                          {t.after}
                        </p>
                      </div>

                      <div
                        className="flex items-center gap-3 pt-4"
                        style={{ borderTop: '1px solid var(--ls-border)' }}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: 'var(--ls-blue-primary)' }}
                        >
                          {t.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm" style={{ color: 'var(--ls-text)' }}>
                            {t.name}
                          </p>
                        </div>
                        <span
                          className="text-xs font-semibold px-2 py-1 rounded-full shrink-0 whitespace-nowrap"
                          style={{ background: '#dcfce7', color: 'var(--ls-success)' }}
                        >
                          {t.badge}
                        </span>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '88px 0' }}>
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <h2 className="mb-4" style={{ color: '#fff', maxWidth: 580, margin: '0 auto 1rem' }}>
              Your outcome could be next.
            </h2>
            <p
              className="text-lg mb-8"
              style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 440, margin: '0 auto 2rem' }}
            >
              Find the program that matches where you are right now, and where you want to be.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/programs"
                className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 transition-transform"
                style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}
              >
                Find Your Program <ArrowRight size={16} />
              </Link>
              <Link
                href="/placements"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl border-2 hover:-translate-y-0.5 transition-transform"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', fontSize: '0.9375rem' }}
              >
                See Placement Data
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
