'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef, ReactNode } from 'react';

const ease = [0.0, 0.0, 0.2, 1.0] as const;

interface AnimateOnScrollProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
}

export function AnimateOnScroll({
  children,
  delay = 0,
  className,
  once = true,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();
  const isInView = useInView(ref, { once, margin: '-60px' });

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.45, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.07,
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduce = useReducedMotion();
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.45, ease },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function HoverCard({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}
      transition={{ duration: 0.2 }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
