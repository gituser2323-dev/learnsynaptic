'use client';

import { ArrowRight } from 'lucide-react';
import { Magnetic, GridBackdrop, NoiseOverlay, GlowOrbs, FloatingParticles, RevealHeadline } from './primitives';

export function ChapterFinalCTA({ batchDateLabel }: { batchDateLabel: string }) {
  return (
    <section className="b-chapter b-chapter-dark relative flex flex-col" style={{ paddingTop: 140, paddingBottom: 48 }}>
      <GridBackdrop />
      <NoiseOverlay />
      <FloatingParticles count={10} />
      <GlowOrbs orbs={[{ top: '10%', left: '50%', size: 620, color: 'var(--b-blue)', opacity: 0.24 }]} />

      <div className="b-container relative text-center flex-1 flex flex-col justify-center" style={{ paddingBottom: 96 }}>
        <RevealHeadline
          as="h2"
          triggerOnScroll
          lines={['The future belongs to builders.', 'Your journey starts today.']}
          style={{
            fontSize: 'clamp(2.25rem, 5vw, 4rem)',
            fontWeight: 800,
            maxWidth: 880,
            margin: '0 auto',
            lineHeight: 1.12,
          }}
        />

        <p className="b-muted mt-7" style={{ maxWidth: 480, margin: '1.75rem auto 0', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          Free. Live. Seven days. Batch starts {batchDateLabel} — and it&apos;s capped so every
          builder gets real mentor feedback.
        </p>

        <div className="mt-11 flex justify-center">
          <Magnetic>
            <a href="#register" className="b-btn-primary" style={{ fontSize: '1.0625rem', padding: '1.1875rem 2.75rem' }}>
              Reserve My FREE Seat <ArrowRight size={18} />
            </a>
          </Magnetic>
        </div>
      </div>

      <div className="relative b-container" style={{ borderTop: '1px solid var(--b-line-dark-soft)', paddingTop: 28 }}>
        <p className="text-center b-muted" style={{ fontSize: '0.75rem' }}>
          © {new Date().getFullYear()} LearnSynaptic · Ahilyanagar, India
        </p>
      </div>
    </section>
  );
}
