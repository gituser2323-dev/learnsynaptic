'use client';

import { useState } from 'react';
import { CheckCheck, MessageCircle, Quote, Star, ThumbsUp } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';

interface TestimonialCardProps {
  name: string;
  role: string;
  quote: string;
  badge: string;
  initials: string;
}

export function TestimonialCard2({ name, role, quote, badge, initials }: TestimonialCardProps) {
  const [hovered, setHovered] = useState(false);
  const shouldReduce = useReducedMotion();

  // Reduced motion: only border colour change, no movement
  const active = hovered && !shouldReduce;
  const reducedActive = hovered && shouldReduce;

  return (
<div
  className="
  group
  relative
  overflow-hidden
  rounded-[28px]
  border
  border-[#d8f5d2]
  bg-[#E7FFDB]
  p-5
  shadow-[0_12px_35px_rgba(0,0,0,.06)]
  transition-all
  duration-300
  hover:-translate-y-1
  hover:shadow-[0_20px_45px_rgba(0,0,0,.10)]
"
>
  {/* Header */}

  <div className="mb-4 flex items-center gap-3">

    <div className="relative">

      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#165DFC] font-bold text-white">

        {initials}

      </div>

      {/* Online dot */}

      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#E7FFDB] bg-[#25D366]" />

    </div>

    <div className="flex-1">

      <h4 className="font-semibold text-slate-900">

        {name}

      </h4>

      <p className="text-xs text-slate-500">

        online

      </p>

    </div>

    <MessageCircle
      size={18}
      className="text-[#25D366]"
    />

  </div>

  {/* Bubble */}

  <div
    className="
    relative
    rounded-2xl
    bg-white
    p-4
    shadow-sm
  "
  >

    {/* Bubble tail */}

    <div
      className="
      absolute
      -left-2
      top-4
      h-4
      w-4
      rotate-45
      bg-white
    "
    />

    <p
      className="
      whitespace-pre-line
      text-[15px]
      leading-7
      text-slate-700
    "
    >
      {quote}
    </p>

    <div className="mt-3 flex items-center justify-end gap-1">

      <span className="text-[11px] text-slate-400">

        {badge}

      </span>

      <CheckCheck
        size={14}
        className="text-[#53BDEB]"
      />

    </div>

  </div>
</div>
  );
}
