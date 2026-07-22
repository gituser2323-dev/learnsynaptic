'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';
import { ChapterMark, GridBackdrop, GlowOrbs } from './primitives';

const log = [
  { stage: 'Today', cmd: '$ status --check', out: "still watching tutorials. haven't opened Cursor yet." },
  { stage: 'Learning', cmd: '$ day_02.log', out: 'LLMs, prompting, dev environment — set up.' },
  { stage: 'Building', cmd: '$ day_05.log', out: 'React + OpenAI API + MCP agent — wired and working.' },
  { stage: 'Portfolio', cmd: '$ day_07.log', out: 'deploy --prod → capstone live, repo public.' },
  { stage: 'Interview', cmd: '$ interview.log', out: 'walked through my own commits, not a tutorial\'s.' },
  { stage: 'Career', cmd: '$ +45d.log', out: 'offer accepted. "You\'re hired."' },
];

export function ChapterPath() {
  const shouldReduce = useReducedMotion();

  return (
    <section className="b-chapter b-chapter-dark" style={{ padding: '112px 0' }}>
      <GridBackdrop animate={false} />
      <GlowOrbs orbs={[{ top: '-8%', left: '30%', size: 480, color: 'var(--b-blue)', opacity: 0.18 }]} />

      <div className="b-container relative">
        <AnimateOnScroll className="text-center mb-14">
          <ChapterMark index="04" label="The Builder's Path" />
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, maxWidth: 680, margin: '0 auto' }}>
            Six stages. One decision to start.
          </h2>
          <p className="b-muted mt-4" style={{ maxWidth: 520, margin: '1rem auto 0', fontSize: '1rem', lineHeight: 1.7 }}>
            This is the exact arc every builder in this program walks — logged the way a
            developer actually tracks progress.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.05} className="max-w-2xl mx-auto">
          <div className="rounded-2xl overflow-hidden b-glass">
            <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderBottom: '1px solid var(--b-line-dark)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#F87171' }} />
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#FBBF24' }} />
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#34D399' }} />
              <span className="ml-2" style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'var(--b-text-onDark-muted)' }}>
                builder@learnsynaptic — zsh
              </span>
            </div>

            <div className="px-4 sm:px-6 py-6 flex flex-col gap-4">
              {log.map((l, i) => (
                <AnimateOnScroll key={l.stage} delay={i * 0.09} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      color: i === log.length - 1 ? '#5ED9A0' : 'var(--b-blue-soft)',
                      background: i === log.length - 1 ? 'rgba(94,217,160,0.1)' : 'rgba(91,140,255,0.1)',
                      width: 78,
                      textAlign: 'center' as const,
                    }}
                  >
                    {l.stage}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
                    {l.cmd}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.6 }}>
                    {l.out}
                    {i === log.length - 1 && (
                      <motion.span
                        aria-hidden="true"
                        animate={shouldReduce ? undefined : { opacity: [1, 0, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        style={{ marginLeft: 4, color: '#5ED9A0' }}
                      >
                        ▍
                      </motion.span>
                    )}
                  </span>
                </AnimateOnScroll>
              ))}
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
