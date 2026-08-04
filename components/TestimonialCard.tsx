'use client';

import { useState } from 'react';
import { Quote, Star, ThumbsUp } from 'lucide-react';
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
  className="group h-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
>
  {/* Header */}
  <div className="flex items-start justify-between">
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#165DFC] font-bold text-white">
        {initials}
      </div>

      <div>
        {/* h3, not h4: the nearest section heading on pages that render
            this card is h2 (e.g. "Real students. Real outcomes." on the
            homepage) — h4 skipped a level. Same classes, so no visual
            change (Module 10 performance audit — Lighthouse flagged
            this specific node). */}
        <h3 className="font-semibold text-slate-900">{name}</h3>

        <p className="text-xs text-slate-500">{role}</p>
      </div>
    </div>

    <span className="text-slate-400 text-xl">⋮</span>
  </div>

  {/* Stars
  <div className="mt-5 flex items-center gap-1">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={15}
        className="fill-[#FBBC04] text-[#FBBC04]"
      />
    ))}


  </div> */}

  {/* Review */}
  <p className="mt-4 text-[15px] leading-7 text-slate-700">
    {quote}
  </p>

  {/* Footer */}
  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">

    <div className="flex items-center gap-2 text-sm text-slate-500">

      <ThumbsUp size={15} />

      <span>Helpful</span>

    </div>

    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#165DFC]">
      {badge}
    </span>

  </div>
</div>
  );
}
