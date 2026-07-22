import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';
import { ChapterMark } from './primitives';

type DiffLine = { type: 'ctx' | 'add' | 'del'; text: string };

const diff: DiffLine[] = [
  { type: 'ctx', text: 'Requirements' },
  { type: 'del', text: '2+ years of professional software experience' },
  { type: 'ctx', text: 'Familiarity with REST APIs and SQL' },
  { type: 'add', text: 'Hands-on experience building with LLM / AI APIs' },
  { type: 'add', text: 'Comfortable pairing with AI coding tools (Cursor, Copilot)' },
  { type: 'add', text: 'Has shipped at least one project independently, end-to-end' },
];

function DiffRow({ type, text }: DiffLine) {
  const marker = type === 'add' ? '+' : type === 'del' ? '-' : ' ';
  const markerColor = type === 'add' ? '#5ED9A0' : type === 'del' ? '#F87171' : 'rgba(255,255,255,0.25)';
  const bg = type === 'add' ? 'rgba(94,217,160,0.08)' : type === 'del' ? 'rgba(248,113,113,0.08)' : 'transparent';
  const textColor = type === 'ctx' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.92)';

  return (
    <div className="flex items-start gap-3 px-4 sm:px-5 py-2" style={{ background: bg }}>
      <span style={{ color: markerColor, fontFamily: 'monospace', fontSize: '0.8125rem', width: 12, flexShrink: 0 }}>
        {marker}
      </span>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '0.8125rem',
          lineHeight: 1.7,
          color: textColor,
          textDecoration: type === 'del' ? 'line-through' : 'none',
          textDecorationColor: 'rgba(248,113,113,0.5)',
        }}
      >
        {text}
      </span>
    </div>
  );
}

export function ChapterWhyNow() {
  return (
    <section className="b-chapter b-chapter-light" style={{ padding: '112px 0' }}>
      <div className="b-container">
        <AnimateOnScroll className="text-center">
          <ChapterMark index="03" label="Why AI Builders Are Winning" />
          <h2
            style={{
              fontSize: 'clamp(2rem, 4.2vw, 3.25rem)',
              fontWeight: 800,
              maxWidth: 760,
              margin: '0 auto',
              lineHeight: 1.15,
            }}
          >
            The hiring bar didn&apos;t move. It jumped.
          </h2>
          <p className="mt-6" style={{ maxWidth: 560, margin: '1.5rem auto 0', fontSize: '1.0625rem', lineHeight: 1.75, color: 'var(--b-text-onLight-muted)' }}>
            This is what changed inside a typical junior-developer job posting between 2023 and
            now — the same role, a different bar.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.1} className="max-w-xl mx-auto mt-14">
          <div className="rounded-2xl overflow-hidden" style={{ background: '#08080D', border: '1px solid rgba(0,0,0,0.08)' }}>
            <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#F87171' }} />
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#FBBF24' }} />
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#34D399' }} />
              <span className="ml-2" style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)' }}>
                junior-developer-role.diff
              </span>
            </div>
            <div className="py-2">
              {diff.map((line, i) => (
                <DiffRow key={i} {...line} />
              ))}
            </div>
          </div>
          <p className="text-center mt-4" style={{ fontSize: '0.75rem', color: 'var(--b-text-onLight-muted)' }}>
            A composite of real postings, not one specific listing.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.15} className="max-w-2xl mx-auto mt-16 text-center">
          <p
            style={{
              fontSize: 'clamp(1.375rem, 2.6vw, 1.75rem)',
              fontWeight: 700,
              lineHeight: 1.5,
              color: 'var(--b-text-onLight)',
              letterSpacing: '-0.01em',
            }}
          >
            &ldquo;You don&apos;t need to be the smartest person in the room.
            <br className="hidden sm:block" /> You need to be the one who already{' '}
            <span style={{ color: 'var(--b-blue)' }}>built something.</span>&rdquo;
          </p>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
