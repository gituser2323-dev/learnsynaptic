'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const DEFAULT_COLORS = ['#1447E6', '#60A5FA', '#16A34A', '#F59E0B', '#EFF6FF'];

interface Piece {
  id: number;
  left: number;
  color: string;
  rotate: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
}

export function Confetti({ count = 60, colors = DEFAULT_COLORS }: { count?: number; colors?: string[] }) {
  const shouldReduce = useReducedMotion();

  // useState's lazy initializer is the sanctioned escape hatch for one-time
  // impure work (Math.random) — it runs exactly once, unlike a useMemo factory.
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[i % colors.length],
      rotate: Math.random() * 360,
      delay: Math.random() * 0.4,
      duration: 2.2 + Math.random() * 1.4,
      size: 6 + Math.random() * 6,
      drift: (Math.random() - 0.5) * 120,
    })),
  );

  if (shouldReduce) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -40, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', x: p.drift, opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
