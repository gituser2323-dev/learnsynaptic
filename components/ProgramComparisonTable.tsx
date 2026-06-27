import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';

const programs = [
  {
    tag: 'Start here',
    name: 'AI Beginner Bootcamp',
    duration: '10 days',
    bestFor: 'Complete beginners — zero coding required',
    format: 'Live',
    keySkills: 'AI awareness, tool usage, first automation',
    nextStep: 'GenAI Builder →',
    href: '/programs/bootcamp',
  },
  {
    tag: 'High Demand',
    name: 'GenAI Builder',
    duration: '3.5 months',
    bestFor: 'MERN devs wanting AI & freelance skills',
    format: 'Self-paced + live reviews',
    keySkills: 'RAG, AI APIs, freelancing, client projects',
    nextStep: 'Full Stack Dev →',
    href: '/programs/genai-builder',
  },
  {
    tag: 'Most Popular',
    name: 'AI Full Stack Dev + DevOps',
    duration: '6 months',
    bestFor: 'Job-ready full stack engineers',
    format: 'Live cohort',
    keySkills: 'MERN, AI integration, Docker, AWS, CI/CD',
    nextStep: 'Career-ready',
    href: '/programs/full-stack-devops',
  },
  {
    tag: 'Specialist',
    name: 'Data Science',
    duration: '4 months', // [EDIT: confirm exact duration]
    bestFor: 'Analytical & ML-focused learners',
    format: 'Live',
    keySkills: 'Python, ML models, Power BI, deployment',
    nextStep: 'Specialist track',
    href: '/programs/data-science',
  },
];

const columns = ['Duration', 'Best For', 'Format', 'Key Skills'];

export function ProgramComparisonTable() {
  return (
    <section className="ls-section">
      <div className="ls-container">
        <AnimateOnScroll className="mb-10">
          <span className="ls-badge mb-4 inline-flex">Compare programs</span>
          <h2 className="mb-3">Choose your starting point</h2>
          <p style={{ maxWidth: 520, color: 'var(--ls-muted)' }}>
            Every path is different. Find the program that matches where you are right
            now — not where you want to be eventually.
          </p>
        </AnimateOnScroll>

        {/* Desktop table — visible lg+ */}
        <AnimateOnScroll>
          <div
            className="hidden lg:block overflow-hidden rounded-2xl border"
            style={{ borderColor: 'var(--ls-border)' }}
          >
            {/* Header row */}
            <div
              className="grid gap-0 px-6 py-3"
              style={{
                gridTemplateColumns: '220px 90px 1fr 140px 1fr 160px',
                background: 'var(--ls-bg-alt)',
                borderBottom: '1px solid var(--ls-border)',
              }}
            >
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ls-muted)' }}>
                Program
              </span>
              {columns.map((col) => (
                <span
                  key={col}
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: 'var(--ls-muted)' }}
                >
                  {col}
                </span>
              ))}
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ls-muted)' }}>
                Next step
              </span>
              <span />
            </div>

            {/* Program rows */}
            {programs.map((p, i) => (
              <div
                key={p.name}
                className="grid gap-0 px-6 py-5 items-center"
                style={{
                  gridTemplateColumns: '220px 90px 1fr 140px 1fr 160px',
                  background: i % 2 === 0 ? '#fff' : 'var(--ls-bg-alt)',
                  borderTop: i > 0 ? '1px solid var(--ls-border)' : undefined,
                }}
              >
                {/* Program name + tag */}
                <div>
                  <span
                    className="inline-block mb-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--ls-blue-tint)', color: 'var(--ls-blue-primary)' }}
                  >
                    {p.tag}
                  </span>
                  <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--ls-text)' }}>
                    {p.name}
                  </p>
                </div>

                {/* Duration */}
                <p className="text-sm font-semibold" style={{ color: 'var(--ls-text)' }}>
                  {p.duration}
                </p>

                {/* Best For */}
                <p className="text-sm pr-4 leading-snug" style={{ color: 'var(--ls-muted)' }}>
                  {p.bestFor}
                </p>

                {/* Format */}
                <p className="text-sm" style={{ color: 'var(--ls-muted)' }}>
                  {p.format}
                </p>

                {/* Key Skills */}
                <p className="text-sm pr-4 leading-snug" style={{ color: 'var(--ls-muted)' }}>
                  {p.keySkills}
                </p>

                {/* Next step + CTA */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--ls-muted)' }}>
                    {p.nextStep}
                  </span>
                  <Link
                    href={p.href}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all hover:-translate-y-0.5"
                    style={{
                      borderColor: 'var(--ls-blue-primary)',
                      color: 'var(--ls-blue-primary)',
                      background: 'var(--ls-blue-tint)',
                    }}
                  >
                    Explore <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </AnimateOnScroll>

        {/* Mobile cards — visible < lg */}
        <div className="lg:hidden space-y-4">
          {programs.map((p) => (
            <div
              key={p.name}
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: 'var(--ls-border)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <span
                    className="inline-block mb-1.5 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--ls-blue-tint)', color: 'var(--ls-blue-primary)' }}
                  >
                    {p.tag}
                  </span>
                  <p className="font-bold text-base" style={{ color: 'var(--ls-text)' }}>
                    {p.name}
                  </p>
                </div>
                <p className="text-lg font-bold shrink-0" style={{ color: 'var(--ls-blue-primary)' }}>
                  {p.duration}
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  { label: 'Best For', value: p.bestFor },
                  { label: 'Format', value: p.format },
                  { label: 'Key Skills', value: p.keySkills },
                  { label: 'Next Step', value: p.nextStep },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3 text-sm">
                    <span
                      className="shrink-0 w-20 font-semibold text-xs pt-0.5"
                      style={{ color: 'var(--ls-muted)' }}
                    >
                      {label}
                    </span>
                    <span style={{ color: 'var(--ls-text)' }}>{value}</span>
                  </div>
                ))}
              </div>

              <Link
                href={p.href}
                className="ls-btn-primary mt-4 w-full justify-center text-sm py-2.5"
              >
                Explore Program <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>

        <AnimateOnScroll className="text-center mt-8">
          <Link href="/programs" className="ls-btn-outline">
            Compare All Programs in Detail
            <ArrowRight size={15} />
          </Link>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
