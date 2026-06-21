'use client';

import { useRef, useCallback, useEffect, type ReactNode, type CSSProperties } from 'react';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Max rotation in degrees (±8° per axis)
const MAX_ROT = 8;

export function TiltCard({ children, className, style }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  // Capture initial border/background from props for clean reset
  const baseBorder = (style?.borderColor as string | undefined) ?? 'var(--ls-border)';
  const baseBg = (style?.background as string | undefined) ?? '#fff';

  const setHoverStyles = useCallback((
    el: HTMLDivElement,
    rx: number,
    ry: number,
  ) => {
    // No transition on transform — cursor follows directly
    el.style.transition =
      'background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, backdrop-filter 150ms ease';
    el.style.transform =
      `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px) scale(1.02)`;
    el.style.background = 'rgba(255,255,255,0.6)';
    el.style.backdropFilter = 'blur(10px)';
    el.style.borderColor = 'rgba(20,71,230,0.2)';
    el.style.boxShadow = '0 20px 40px -12px rgba(20,71,230,0.25)';
    el.setAttribute('data-tilt', 'true');
  }, []);

  const resetStyles = useCallback((el: HTMLDivElement) => {
    // Smooth reset — 100ms for transform as specified, slightly longer for surface props
    el.style.transition =
      'transform 0.1s ease-out, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, backdrop-filter 0.2s ease';
    el.style.transform =
      'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)';
    el.style.background = baseBg;
    el.style.backdropFilter = 'blur(0px)';
    el.style.borderColor = baseBorder;
    el.style.boxShadow = 'none';
    el.removeAttribute('data-tilt');
  }, [baseBg, baseBorder]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    // Snapshot coords before the async frame so they're stable
    const clientX = e.clientX;
    const clientY = e.clientY;
    raf.current = requestAnimationFrame(() => {
      const el2 = ref.current;
      if (!el2) return;
      const rect = el2.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width - 0.5;   // -0.5 → 0.5
      const y = (clientY - rect.top) / rect.height - 0.5;
      setHoverStyles(el2, -y * MAX_ROT * 2, x * MAX_ROT * 2);
    });
  }, [setHoverStyles]);

  const handleMouseEnter = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (el) setHoverStyles(el, 0, 0);
  }, [setHoverStyles]);

  const handleMouseLeave = useCallback(() => {
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null; }
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.borderColor = '';
      return;
    }
    resetStyles(el);
  }, [resetStyles]);

  // Reduced-motion: simple border highlight on hover
  const handleEnterReduced = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = 'rgba(20,71,230,0.25)';
    e.currentTarget.style.transition = 'border-color 150ms ease';
  }, []);
  const handleLeaveReduced = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = baseBorder;
  }, [baseBorder]);

  // Cleanup RAF on unmount
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  // Touch: brief glass lift, no tilt (hover media query won't fire on touch-only)
  const handleTouchStart = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 150ms ease, box-shadow 150ms ease';
    el.style.transform = 'translateY(-2px) scale(1.01)';
    el.style.boxShadow = '0 8px 24px rgba(20,71,230,0.15)';
  }, []);
  const handleTouchEnd = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setTimeout(() => { if (el) resetStyles(el); }, 300);
  }, [resetStyles]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      // Reduced-motion fallback overrides (checked inline in handlers)
    >
      {children}
    </div>
  );
}
