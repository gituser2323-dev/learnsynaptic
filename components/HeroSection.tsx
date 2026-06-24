'use client';

import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { motion, useReducedMotion, type Transition } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Calendar } from 'lucide-react';
import { SplineScene } from '@/components/ui/spline-scene';

const trustStats = [
  '3200+ Students Trained',
  '75% Placement Rate',
  'Pune-based, Pan-India Reach',
];

const ease = [0.0, 0.0, 0.2, 1.0] as const;

const headlineWords = ['BUILD', 'THE', 'SKILLS', 'COMPANIES', 'WILL', 'HIRE', 'FOR', 'IN', '2027'];

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
      gsap.set(spans, { opacity: 0, y: 20 });
      gsap.to(spans, {
        opacity: 1,
        y: 0,
        stagger: 0.05,
        duration: 0.5,
        delay: 0.2,
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
      className="relative overflow-hidden pt-32 pb-20 sm:pt-36 sm:pb-24 lg:pt-40 lg:pb-28"
      style={{ background: 'var(--ls-hero-bg)' }}
    >
      {/* Spline 3D — decorative background layer, right-side weighted, low visual weight */}
      {/* TODO: Replace with custom LearnSynaptic Spline scene from spline.design */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-full lg:w-3/5"
        aria-hidden="true"
        style={{ opacity: 0.35 }}
      >
        <SplineScene
          scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
          className="w-full h-full"
        />
      </div>

      <div className="ls-container relative z-10 flex flex-col items-center text-center">
        {/* Batch badge */}
        <motion.div {...fadeIn(0.1)}>
          <span className="ls-badge mb-4 inline-flex">
            <Calendar size={13} />
            Next Batch: July 7, 2026
          </span>
        </motion.div>

        {/* H1 — GSAP word reveal */}
        <h1
          ref={headlineRef}
          className="mb-4"
          style={{ maxWidth: 900, color: 'var(--ls-text)', letterSpacing: '-0.025em' }}
        >
          {headlineWords.map((word, i) => (
            <span
              key={i}
              className="hero-word inline-block mr-[0.28em]"
            >
              {word === '2027' ? (
                <span style={{ color: 'var(--ls-blue-primary)' }}>{word}</span>
              ) : (
                word
              )}
            </span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          {...fadeIn(0.6)}
          className="text-lg sm:text-xl mb-8 mt-2"
          style={{ maxWidth: 640, color: 'var(--ls-muted)', lineHeight: 1.7 }}
        >
          The market has already moved on — master in-demand technologies, build real-world
          projects, and land your dream job with personalized mentorship and placement support.
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeIn(0.8)}
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

        {/* Trust stats */}
        <motion.div
          {...fadeIn(0.95)}
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
