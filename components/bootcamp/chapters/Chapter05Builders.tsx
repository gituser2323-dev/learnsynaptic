import Image from 'next/image';
import { Users2, GraduationCap, BadgeCheck } from 'lucide-react';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';
import { LogoMarquee } from '@/components/LogoMarquee';
import { ChapterMark, GridBackdrop, NoiseOverlay, GlowOrbs } from './primitives';

const credentials = [
  { Icon: GraduationCap, label: '3+ Years Experience' },
  { Icon: Users2, label: '1,000+ Students Mentored' },
  { Icon: BadgeCheck, label: 'Industry AI & Full Stack Mentor' },
];

// Real graduate quotes, presented the way they actually arrived — as
// messages in the batch group, not staged review cards.
const messages = [
  {
    name: 'Sumit Matale',
    tag: 'now SDE',
    initials: 'SM',
    color: '#5B8CFF',
    time: '9:14 AM',
    text: "Honestly one of the best learning experiences I've had. Pratik sir explains even difficult topics in a very simple way and always encourages us to build instead of just watching.",
  },
  {
    name: 'Chetana Alekar',
    tag: 'AI Full Stack batch',
    initials: 'CA',
    color: '#22C55E',
    time: '11:02 AM',
    text: 'Very supportive mentors and a friendly environment. I never felt hesitant to ask questions, even basic ones. Every doubt was cleared patiently.',
  },
  {
    name: 'Swaraj Suryawanshi',
    tag: 'AI Full Stack batch',
    initials: 'SW',
    color: '#F59E0B',
    time: '3:47 PM',
    text: 'Mock interview helped a lot — the interviewer literally asked React questions we practiced in class 🔥',
  },
];

function AlumniThread() {
  return (
    <div className="rounded-3xl overflow-hidden max-w-2xl mx-auto" style={{ border: '1px solid var(--b-line-dark)' }}>
      <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: '#202C33' }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--b-blue)' }}>
          <Users2 size={15} color="#fff" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">LearnSynaptic Alumni</p>
          <p className="text-[11px]" style={{ color: '#8696A0' }}>
            Sumit, Chetana, Swaraj and 1,000+ others
          </p>
        </div>
      </div>
      <div className="p-4 sm:p-5 flex flex-col gap-3.5" style={{ background: '#0B141A' }}>
        {messages.map((m) => (
          <div key={m.name} className="flex items-start gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold text-white"
              style={{ background: m.color, fontSize: '0.5625rem' }}
            >
              {m.initials}
            </div>
            <div
              className="inline-block rounded-lg rounded-tl-none px-3.5 py-2.5"
              style={{ background: '#202C33', maxWidth: '85%' }}
            >
              <p className="text-[12px] font-semibold mb-1" style={{ color: m.color }}>
                {m.name} <span style={{ color: '#8696A0', fontWeight: 400 }}>· {m.tag}</span>
              </p>
              <p className="text-[13px] leading-relaxed text-white">{m.text}</p>
              <p className="text-[10px] text-right mt-1.5" style={{ color: '#8696A0' }}>
                {m.time} ✓✓
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChapterBuilders() {
  return (
    <section className="b-chapter b-chapter-ink" style={{ padding: '112px 0 0' }}>
      <GridBackdrop animate={false} />
      <NoiseOverlay />
      <GlowOrbs orbs={[{ top: '10%', right: '-8%', size: 400, color: 'var(--b-blue)', opacity: 0.14 }]} />

      <div className="b-container relative">
        <AnimateOnScroll className="text-center mb-14">
          <ChapterMark index="09" label="Builders Who Started Here" />
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, maxWidth: 640, margin: '0 auto' }}>
            You&apos;re not learning from a syllabus. You&apos;re learning from someone who ships.
          </h2>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.05} className="mb-16">
          <div
            className="rounded-3xl border bg-white p-8 sm:p-10 max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-8"
            style={{ borderColor: 'var(--b-line-light)' }}
          >
            <div className="relative shrink-0 rounded-2xl overflow-hidden" style={{ width: 156, height: 156 }}>
              <Image src="/learn.jpeg" alt="Pratik Sabale, Founder of LearnSynaptic" fill sizes="156px" className="object-cover" />
            </div>
            <div className="text-center sm:text-left">
              <p className="b-eyebrow mb-2" style={{ display: 'inline-flex' }}>
                Your mentor for this bootcamp
              </p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Pratik Sabale</h3>
              <p className="text-sm font-semibold mt-1" style={{ color: 'var(--b-text-onLight-muted)' }}>
                Founder, LearnSynaptic
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2 mt-5">
                {credentials.map(({ Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <Icon size={14} style={{ color: 'var(--b-blue)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--b-text-onLight)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.1} className="pb-16">
          <AlumniThread />
        </AnimateOnScroll>
      </div>

      <LogoMarquee />
    </section>
  );
}
