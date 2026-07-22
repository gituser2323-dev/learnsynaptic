import { Quote, GraduationCap, Award, UserCheck, Briefcase, Repeat2 } from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';
import { ChapterMark, GridBackdrop, NoiseOverlay, GlowOrbs } from './primitives';

const innerVoices = [
  "I'm watching AI videos every day but still can't build anything.",
  "I know ChatGPT but don't know how developers actually use AI.",
  "I've completed multiple courses but still don't feel job-ready.",
];

const audiences = [
  { title: 'Engineering Students', Icon: GraduationCap, body: 'Your syllabus won’t teach you AI APIs. Close the gap in 7 days.' },
  { title: 'Final Year Students', Icon: Award, body: 'Walk into placement season with a shipped AI project, not another assignment.' },
  { title: 'Freshers', Icon: UserCheck, body: 'Stand out in a flooded market with hands-on AI proof, not just a resume line.' },
  { title: 'Working Professionals', Icon: Briefcase, body: 'AI is landing in every job description. Learn to build with it, in the evenings.' },
  { title: 'Career Switchers', Icon: Repeat2, body: 'The fastest structured on-ramp into modern AI-assisted development.' },
];

export function ChapterReckoning() {
  return (
    <section className="b-chapter b-chapter-ink" style={{ padding: '108px 0 96px' }}>
      <GridBackdrop animate={false} />
      <NoiseOverlay />
      <GlowOrbs orbs={[{ top: '20%', right: '-10%', size: 400, color: 'var(--b-blue)', opacity: 0.14 }]} />

      <div className="b-container relative">
        <AnimateOnScroll className="text-center">
          <ChapterMark index="02" label="The Reckoning" />
          <h2
            style={{
              fontSize: 'clamp(2rem, 4.2vw, 3.25rem)',
              fontWeight: 800,
              maxWidth: 780,
              margin: '0 auto',
              lineHeight: 1.15,
            }}
          >
            The gap between knowing AI and building with it —
            <br />
            that&apos;s where careers are decided right now.
          </h2>
          <p className="b-muted mt-6" style={{ maxWidth: 560, margin: '1.5rem auto 0', fontSize: '1.0625rem', lineHeight: 1.75 }}>
            Every cohort of graduates competes with a smaller pool of jobs and a wider skill
            gap. The developers who close that gap early aren&apos;t smarter — they just stopped
            watching, and started shipping.
          </p>
        </AnimateOnScroll>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto mt-16">
          {innerVoices.map((text) => (
            <StaggerItem key={text}>
              <div className="b-glass h-full rounded-2xl p-6" style={{ borderRadius: 20 }}>
                <Quote size={18} className="mb-4" style={{ color: 'var(--b-blue-soft)' }} />
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, fontStyle: 'italic', color: 'var(--b-text-onDark)' }}>
                  &ldquo;{text}&rdquo;
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimateOnScroll delay={0.1} className="text-center mt-24 mb-10">
          <p className="b-eyebrow" style={{ justifyContent: 'center', display: 'inline-flex' }}>
            Built for where you are right now
          </p>
        </AnimateOnScroll>

        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {audiences.map(({ title, Icon, body }) => (
            <StaggerItem key={title}>
              <div className="b-glass h-full rounded-2xl p-5" style={{ borderRadius: 18 }}>
                <Icon size={18} style={{ color: 'var(--b-blue-soft)' }} className="mb-3" />
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 6 }}>{title}</h3>
                <p className="b-muted" style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>{body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
