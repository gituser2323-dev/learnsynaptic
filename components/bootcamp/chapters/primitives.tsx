'use client';

import { useEffect, useRef, useState, ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import { motion, useReducedMotion, useInView } from 'framer-motion';

/* ─── Shared seat-scarcity numbers — single source of truth across chapters ── */
export const TOTAL_SEATS = 50;
export const SEATS_TAKEN = 37;

/* ─── Magnetic wrapper — pulls its child toward the cursor within its bounds ── */
export function Magnetic({
  children,
  className,
  style,
  strength = 0.4,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function onMouseMove(e: ReactMouseEvent<HTMLDivElement>) {
    if (shouldReduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: (e.clientX - rect.left - rect.width / 2) * strength,
      y: (e.clientY - rect.top - rect.height / 2) * strength,
    });
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ display: 'inline-block', ...style }}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 14, mass: 0.5 }}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
    >
      {children}
    </motion.div>
  );
}

/* ─── Chapter marker — "Chapter 0X — Title" kicker used at the top of every chapter ── */
export function ChapterMark({ index, label }: { index: string; label: string }) {
  return (
    <div className="b-eyebrow mb-5">
      <span>Chapter {index}</span>
      <span aria-hidden="true" style={{ opacity: 0.45 }}>
        —
      </span>
      <span>{label}</span>
    </div>
  );
}

/* ─── Animated grid backdrop ──────────────────────────────────────────────── */
export function GridBackdrop({ animate = true }: { animate?: boolean }) {
  return <div className={`b-grid${animate ? ' b-grid-animate' : ''}`} aria-hidden="true" />;
}

/* ─── Noise grain overlay ─────────────────────────────────────────────────── */
export function NoiseOverlay() {
  return <div className="b-noise" aria-hidden="true" />;
}

/* ─── Blurred gradient glow orbs ──────────────────────────────────────────── */
interface Orb {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  size: number;
  color: string;
  opacity?: number;
}

export function GlowOrbs({ orbs }: { orbs: Orb[] }) {
  return (
    <>
      {orbs.map((o, i) => (
        <div
          key={i}
          className="b-glow"
          aria-hidden="true"
          style={{
            top: o.top,
            left: o.left,
            right: o.right,
            bottom: o.bottom,
            width: o.size,
            height: o.size,
            background: o.color,
            opacity: o.opacity ?? 0.35,
          }}
        />
      ))}
    </>
  );
}

/* ─── Ambient floating particles — CSS/SVG only, no WebGL ────────────────── */
interface Particle {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
}

export function FloatingParticles({ count = 14 }: { count?: number }) {
  const shouldReduce = useReducedMotion();

  // Particles are randomized, so they're generated client-side only (after
  // mount) rather than in a useState initializer — server and client would
  // otherwise compute different random values and React would flag a
  // hydration mismatch on every render. Defer setState via rAF so the update
  // isn't synchronous inside the effect body.
  const [particles, setParticles] = useState<Particle[] | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setParticles(
        Array.from({ length: count }, (_, i) => ({
          id: i,
          left: Math.random() * 100,
          top: Math.random() * 100,
          size: 2 + Math.random() * 3,
          duration: 8 + Math.random() * 10,
          delay: Math.random() * 6,
          drift: 14 + Math.random() * 22,
          opacity: 0.15 + Math.random() * 0.35,
        })),
      );
    });
    return () => cancelAnimationFrame(id);
  }, [count]);

  if (shouldReduce || !particles) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="b-particle"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, opacity: p.opacity }}
          animate={{ y: [0, -p.drift, 0], opacity: [p.opacity, p.opacity * 1.6, p.opacity] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ─── Kinetic headline — one-time per-line reveal on mount, never re-triggers ── */
export function RevealHeadline({
  lines,
  className,
  style,
  as = 'h1',
  delayStart = 0,
  triggerOnScroll = false,
}: {
  lines: string[];
  className?: string;
  style?: React.CSSProperties;
  as?: 'h1' | 'h2';
  delayStart?: number;
  /** false (default) reveals on mount — for above-the-fold headlines. true reveals once
   *  scrolled into view — for headlines further down the page. */
  triggerOnScroll?: boolean;
}) {
  const shouldReduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const As = as;

  if (shouldReduce) {
    return (
      <As className={className} style={style}>
        {lines.map((l, i) => (
          <span key={i}>
            {l}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </As>
    );
  }

  const revealed = triggerOnScroll ? isInView : true;

  return (
    <As ref={ref as never} className={className} style={style}>
      {lines.map((line, i) => (
        <span key={i} style={{ display: 'block', overflow: 'hidden' }}>
          <motion.span
            style={{ display: 'block' }}
            initial={{ y: '112%', opacity: 0 }}
            animate={revealed ? { y: '0%', opacity: 1 } : undefined}
            transition={{ duration: 0.85, delay: delayStart + i * 0.11, ease: [0.16, 1, 0.3, 1] }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </As>
  );
}

/* ─── Countdown, on-brand — used by Hero and the Reserve chapter ─────────── */
interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(target: Date): TimeLeft {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

const COUNTDOWN_UNITS: { key: keyof TimeLeft; label: string }[] = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hrs' },
  { key: 'minutes', label: 'Min' },
  { key: 'seconds', label: 'Sec' },
];

export function BuildersCountdown({ target, compact = false }: { target: Date; compact?: boolean }) {
  const [t, setT] = useState<TimeLeft>(() => getTimeLeft(target));

  useEffect(() => {
    const id = setInterval(() => setT(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="flex items-center gap-2" role="timer" aria-label="Time remaining to reserve your seat">
      {COUNTDOWN_UNITS.map(({ key, label }, i) => (
        <div key={key} className="flex items-center gap-2">
          <div className="text-center">
            <div
              suppressHydrationWarning
              className="font-bold tabular-nums rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid var(--b-line-dark)',
                color: '#fff',
                fontSize: compact ? '0.9375rem' : '1.25rem',
                padding: compact ? '6px 9px' : '10px 14px',
                minWidth: compact ? 36 : 50,
                lineHeight: 1,
              }}
            >
              {String(t[key]).padStart(2, '0')}
            </div>
            <div
              className="mt-1.5 font-semibold uppercase tracking-wider"
              style={{ fontSize: compact ? '0.5625rem' : '0.6875rem', color: 'var(--b-text-onDark-muted)' }}
            >
              {label}
            </div>
          </div>
          {i < COUNTDOWN_UNITS.length - 1 && (
            <span style={{ color: 'var(--b-line-dark)', fontWeight: 700, marginBottom: compact ? 16 : 20 }}>:</span>
          )}
        </div>
      ))}
    </div>
  );
}
