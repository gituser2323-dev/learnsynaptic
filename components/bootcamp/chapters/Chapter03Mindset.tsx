import { Check, X } from 'lucide-react';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';
import { ChapterMark } from './primitives';

const rows = [
  { watcher: 'Theory-heavy lectures', builder: 'Practical, build-first sessions' },
  { watcher: 'Recorded videos only', builder: 'LIVE sessions, daily' },
  { watcher: 'Small, toy exercises', builder: 'Production-style projects' },
  { watcher: 'Generic, outdated syllabus', builder: 'Current AI stack — MCP, agents, Cursor AI' },
  { watcher: 'No mentor feedback', builder: 'Direct mentor review, every day' },
];

export function ChapterMindset() {
  return (
    <section className="b-chapter b-chapter-light" style={{ padding: '112px 0' }}>
      <div className="b-container">
        <ChapterMark index="05" label="The Builder Mindset" />

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-16 items-start mt-6">
          <AnimateOnScroll>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.18, maxWidth: 620 }}>
              There are two kinds of developers in every room.
            </h2>
            <p className="mt-7" style={{ fontSize: '1.125rem', lineHeight: 1.8, color: 'var(--b-text-onLight-muted)', maxWidth: 560 }}>
              Watchers wait for the perfect tutorial, the perfect course, the perfect moment to
              start. Builders ship before they feel ready — and get good by doing, not by
              preparing to do.
            </p>
            <p className="mt-5" style={{ fontSize: '1.125rem', lineHeight: 1.8, color: 'var(--b-text-onLight-muted)', maxWidth: 560 }}>
              This bootcamp doesn&apos;t teach you AI theory. It puts you in the second room —
              seven days, seven live sessions, one real product shipped by your own hands.
            </p>
            <p className="mt-8" style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--b-text-onLight)' }}>
              Which one are you?
            </p>
          </AnimateOnScroll>

          <AnimateOnScroll delay={0.1}>
            <div className="rounded-3xl border overflow-hidden" style={{ borderColor: 'var(--b-line-light)' }}>
              <div className="grid grid-cols-2">
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--b-line-light)' }}>
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--b-text-onLight-muted)' }}
                  >
                    The Watcher
                  </span>
                </div>
                <div
                  className="px-5 py-4 border-b"
                  style={{ borderColor: 'var(--b-line-light)', background: 'rgba(22,93,252,0.05)' }}
                >
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--b-blue)' }}>
                    The Builder
                  </span>
                </div>
              </div>
              {rows.map((r, i) => (
                <div
                  key={r.watcher}
                  className="grid grid-cols-2"
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--b-line-light)' : 'none' }}
                >
                  <div className="px-5 py-4 flex items-start gap-2.5">
                    <X size={14} className="mt-0.5 shrink-0" style={{ color: '#B91C1C', opacity: 0.55 }} />
                    <span className="text-xs" style={{ color: 'var(--b-text-onLight-muted)' }}>{r.watcher}</span>
                  </div>
                  <div className="px-5 py-4 flex items-start gap-2.5" style={{ background: 'rgba(22,93,252,0.05)' }}>
                    <Check size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--b-success)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--b-text-onLight)' }}>{r.builder}</span>
                  </div>
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}
