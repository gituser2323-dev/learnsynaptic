'use client';

import { motion, useReducedMotion, type Transition } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Calendar } from 'lucide-react';

const trustStats = [
  '500+ Students Trained',
  '85% Placement Rate',
  'Pune-based, Pan-India Reach',
];

const ease = [0.0, 0.0, 0.2, 1.0] as const;

export default function HeroSection() {
  const shouldReduce = useReducedMotion();

  const words = ['Build', 'Your', 'Career', 'in', 'AI', '&', 'Technology'];
  const line2 = ['With', 'Real', 'Projects', 'and', 'Expert', 'Mentorship'];

  const wordVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.45,
        ease,
        delay: shouldReduce ? 0 : i * 0.05,
      } satisfies Transition,
    }),
  };

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
        {/* Badge */}
        <motion.div {...fadeIn(0.1)}>
          <span className="ls-badge mb-6 inline-flex">
            <Calendar size={13} />
            Next Batch: July 7, 2025 — Limited Seats
          </span>
        </motion.div>

        {/* H1 — word reveal on page load */}
        <h1 className="mb-2" style={{ maxWidth: 900, color: 'var(--ls-text)' }}>
          {words.map((word, i) => (
            <motion.span
              key={`line1-${i}`}
              custom={i + 1}
              variants={wordVariants}
              initial="hidden"
              animate="visible"
              className="inline-block mr-[0.28em]"
            >
              {word === 'AI' ? (
                <span style={{ color: 'var(--ls-blue-primary)' }}>{word}</span>
              ) : (
                word
              )}
            </motion.span>
          ))}
          <br />
          {line2.map((word, i) => (
            <motion.span
              key={`line2-${i}`}
              custom={words.length + i + 1}
              variants={wordVariants}
              initial="hidden"
              animate="visible"
              className="inline-block mr-[0.28em]"
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          {...fadeIn(0.6)}
          className="text-lg sm:text-xl mb-8 mt-4"
          style={{ maxWidth: 640, color: 'var(--ls-muted)', lineHeight: 1.7 }}
        >
          India&apos;s fast-growing tech training platform for students and early professionals.
          Structured programs, hands-on projects, placement support — from Pune to the whole country.
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeIn(0.75)}
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
          {...fadeIn(0.9)}
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
