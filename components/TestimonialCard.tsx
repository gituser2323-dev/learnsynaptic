'use client';

import { useState } from 'react';
import { Quote } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';

interface TestimonialCardProps {
  name: string;
  role: string;
  quote: string;
  badge: string;
  initials: string;
}

export function TestimonialCard({ name, role, quote, badge, initials }: TestimonialCardProps) {
  const [hovered, setHovered] = useState(false);
  const shouldReduce = useReducedMotion();

  // Reduced motion: only border colour change, no movement
  const active = hovered && !shouldReduce;
  const reducedActive = hovered && shouldReduce;

  return (
    <div
      className="bg-white rounded-2xl border p-6 h-full flex flex-col"
      style={{
        // Warm glow instead of sharp shadow — the "human" treatment
        boxShadow: active
          ? '0 8px 24px rgba(20,71,230,0.12)'
          : '0 0 0 transparent',
        borderColor: active || reducedActive
          ? 'rgba(20,71,230,0.18)'
          : 'var(--ls-border)',
        transform: active ? 'translateY(-3px)' : 'translateY(0)',
        transition: shouldReduce
          ? 'border-color 150ms ease'
          : 'transform 250ms ease-out, box-shadow 250ms ease-out, border-color 200ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Quote
        size={20}
        className="mb-4"
        style={{ color: 'var(--ls-blue-tint)' }}
      />
      <p
        className="text-sm leading-relaxed flex-1 mb-5"
        style={{ color: 'var(--ls-text)' }}
      >
        &ldquo;{quote}&rdquo;
      </p>

      <div
        className="flex items-center gap-3 mt-auto pt-4"
        style={{ borderTop: '1px solid var(--ls-border)' }}
      >
        {/* Avatar — scales slightly on hover, the human-focused detail */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{
            background: 'var(--ls-blue-primary)',
            transform: active ? 'scale(1.05)' : 'scale(1)',
            transition: shouldReduce ? 'none' : 'transform 250ms ease-out',
          }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm" style={{ color: 'var(--ls-text)' }}>
            {name}
          </p>
          <p className="text-xs" style={{ color: 'var(--ls-muted)' }}>
            {role}
          </p>
        </div>

        <span
          className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap"
          style={{ background: '#dcfce7', color: 'var(--ls-success)' }}
        >
          {badge}
        </span>
      </div>
    </div>
  );
}
