'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Magnetic, GridBackdrop, NoiseOverlay, GlowOrbs, FloatingParticles, RevealHeadline, BuildersCountdown } from './primitives';

const trustStats = [
  { value: '3,000+', label: 'Builders trained' },
  { value: '100+', label: 'AI products shipped' },
  { value: '7', label: 'Days to your first launch' },
];

export function ChapterHero({ batchDateLabel, target }: { batchDateLabel: string; target: Date }) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <section
      ref={ref}
      className="b-chapter b-chapter-dark relative flex flex-col justify-center"
      style={{ minHeight: '100svh', paddingTop: 148, paddingBottom: 96 }}
    >
      <GridBackdrop />
      <NoiseOverlay />
      <FloatingParticles count={16} />
      <GlowOrbs
        orbs={[
          { top: '-12%', left: '6%', size: 480, color: 'var(--b-blue)', opacity: 0.28 },
          { bottom: '-16%', right: '2%', size: 420, color: 'var(--b-blue-soft)', opacity: 0.16 },
        ]}
      />

      <motion.div style={shouldReduce ? undefined : { opacity, scale, y }} className="b-container relative text-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center mb-8"
        >
          <span className="b-pill">
            <span style={{ width: 6, height: 6, borderRadius: 9999, background: '#22C55E', display: 'inline-block' }} />
            FREE — 7-Day Live Cohort · Starts {batchDateLabel}
          </span>
        </motion.div>

        <RevealHeadline
          as="h1"
          lines={['Stop Watching Tutorials.', 'Start Shipping AI Products.']}
          style={{
            fontSize: 'clamp(2.75rem, 6.5vw, 5.25rem)',
            fontWeight: 800,
            maxWidth: 980,
            margin: '0 auto',
            lineHeight: 1.05,
          }}
        />

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="b-muted"
          style={{ fontSize: 'clamp(1.0625rem, 1.6vw, 1.25rem)', maxWidth: 620, margin: '2rem auto 0', lineHeight: 1.7 }}
        >
          A free, 7-day live bootcamp where you build real AI products — not watch someone
          else build them. React, OpenAI, MCP, and AI agents, shipped by your own hands.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.62 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-11"
        >
          <Magnetic>

            
            <a href="#register" className="b-btn-primary" style={{ fontSize: '1rem', padding: '1.0625rem 2.25rem' }}>
              Join Whatsapp Community <ArrowRight size={17} />
            </a>
          </Magnetic>
          <Magnetic strength={0.3}>
            <a href="#portfolio" className="b-btn-ghost" style={{ fontSize: '1rem', padding: '1.0625rem 2.25rem' }}>
              See What You&apos;ll Build
            </a>
          </Magnetic>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.78 }}
          className="mt-10 flex justify-center"
        >
          <BuildersCountdown target={target} compact />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-x-12 gap-y-6"
        >
          {trustStats.map((s) => (
            <div key={s.label} className="text-center">
              <div style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {s.value}
              </div>
              <div className="b-muted mt-1" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{ color: 'var(--b-text-onDark-muted)' }}
      >
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Scroll
        </span>
        <motion.div
          animate={shouldReduce ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={16} />
        </motion.div>
      </motion.div>
    </section>
  );
}
