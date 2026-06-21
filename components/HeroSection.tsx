'use client';

import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { motion, useReducedMotion, type Transition } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Calendar } from 'lucide-react';

const trustStats = [
  '500+ Students Trained',
  '85% Placement Rate',
  'Pune-based, Pan-India Reach',
];

const ease = [0.0, 0.0, 0.2, 1.0] as const;

const words = ['Build', 'Your', 'Career', 'in', 'AI', '&', 'Technology'];
const line2 = ['With', 'Real', 'Projects', 'and', 'Expert', 'Mentorship'];

export default function HeroSection() {
  const shouldReduce = useReducedMotion();
  const headlineRef = useRef<HTMLHeadingElement>(null);

  // GSAP: one-shot word reveal on mount, never replays
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const h1 = headlineRef.current;
    if (!h1) return;
    const spans = h1.querySelectorAll<HTMLElement>('.hero-word');
    const ctx = gsap.context(() => {
      // set initial state before paint to avoid flash
      gsap.set(spans, { opacity: 0, y: 20 });
      gsap.to(spans, {
        opacity: 1,
        y: 0,
        stagger: 0.04,   // 40ms — 13 words × 40ms + 500ms = 980ms total ✓
        duration: 0.5,
        ease: 'power3.out',
      });
    });
    return () => ctx.revert();
  }, []);

  const fadeIn = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.45,
      ease,
      delay: shouldReduce ? 0 : delay,
    } satisfies Transition,
  });

  return (
    <section
      className="pt-32 pb-20 sm:pt-36 sm:pb-24 lg:pt-40 lg:pb-28"
      style={{ background: 'var(--ls-hero-bg)' }}
    >
      <div className="ls-container flex flex-col items-center text-center">
        {/* Badge — Framer Motion fade in */}
        <motion.div {...fadeIn(0.1)}>
          <span className="ls-badge mb-6 inline-flex">
            <Calendar size={13} />
            Next Batch: July 7, 2025 — Limited Seats
          </span>
        </motion.div>

        {/* H1 — GSAP word reveal */}
        <h1
          ref={headlineRef}
          className="mb-2"
          style={{ maxWidth: 900, color: 'var(--ls-text)' }}
        >
          {words.map((word, i) => (
            <span
              key={`line1-${i}`}
              className="hero-word inline-block mr-[0.28em]"
            >
              {word === 'AI' ? (
                <span style={{ color: 'var(--ls-blue-primary)' }}>{word}</span>
              ) : (
                word
              )}
            </span>
          ))}
          <br />
          {line2.map((word, i) => (
            <span
              key={`line2-${i}`}
              className="hero-word inline-block mr-[0.28em]"
            >
              {word}
            </span>
          ))}
        </h1>

        {/* Subheadline — Framer Motion fade in */}
        <motion.p
          {...fadeIn(0.55)}
          className="text-lg sm:text-xl mb-8 mt-4"
          style={{ maxWidth: 640, color: 'var(--ls-muted)', lineHeight: 1.7 }}
        >
          India&apos;s fast-growing tech training platform for students and early professionals.
          Structured programs, hands-on projects, placement support — from Pune to the whole country.
        </motion.p>

        {/* CTAs — Framer Motion fade in */}
        <motion.div
          {...fadeIn(0.7)}
          className="flex flex-col sm:flex-row items-center gap-3 mb-8"
        >
          <Link href="/programs" className="ls-btn-primary">
            Explore Programs
            <ArrowRight size={16} />
          </Link>
          <Link href="/contact" className="ls-btn-outline">
            Talk to a Counsellor
          </Link>
        </motion.div>

        {/* Trust stats — Framer Motion fade in */}
        <motion.div
          {...fadeIn(0.85)}
          className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8"
        >
          {trustStats.map((stat) => (
            <div
              key={stat}
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: 'var(--ls-text)' }}
            >
              <CheckCircle2 size={15} style={{ color: 'var(--ls-blue-primary)' }} />
              {stat}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
