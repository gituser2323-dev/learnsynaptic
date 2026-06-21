'use client'

import { useEffect, useRef, useState } from 'react'

export function CustomCursor() {
  const [active, setActive] = useState(false)
  // Outer wrappers — rAF moves these (translate only)
  const dotWrapRef = useRef<HTMLDivElement>(null)
  const ringWrapRef = useRef<HTMLDivElement>(null)
  // Inner elements — CSS transitions handle scale/opacity
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!hasMouse || prefersReduced) return

    setActive(true)
    document.documentElement.classList.add('custom-cursor-active')

    let targetX = 0
    let targetY = 0
    let curX = 0
    let curY = 0
    let rafId: number
    let currentlyHovered = false

    function setHovered(hovered: boolean) {
      if (hovered === currentlyHovered) return
      currentlyHovered = hovered
      if (dotRef.current) {
        dotRef.current.style.transform = hovered ? 'scale(0)' : 'scale(1)'
        dotRef.current.style.opacity = hovered ? '0' : '0.65'
      }
      if (ringRef.current) {
        ringRef.current.style.transform = hovered ? 'scale(1)' : 'scale(0)'
        ringRef.current.style.opacity = hovered ? '0.8' : '0'
      }
    }

    function tick() {
      // Lerp: 0.12 gives a ~120ms settling feel — premium, not laggy
      curX += (targetX - curX) * 0.12
      curY += (targetY - curY) * 0.12

      const t = `translate(${curX}px, ${curY}px)`
      if (dotWrapRef.current) dotWrapRef.current.style.transform = t
      if (ringWrapRef.current) ringWrapRef.current.style.transform = t

      rafId = requestAnimationFrame(tick)
    }

    function onMouseMove(e: MouseEvent) {
      targetX = e.clientX
      targetY = e.clientY
    }

    function onPointerOver(e: PointerEvent) {
      const el = e.target as Element | null
      const interactive = !!el?.closest(
        'a, button, [role="button"], [tabindex]:not([tabindex="-1"]), input, select, textarea, label, summary'
      )
      setHovered(interactive)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    document.addEventListener('pointerover', onPointerOver)
    rafId = requestAnimationFrame(tick)

    return () => {
      document.documentElement.classList.remove('custom-cursor-active')
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerover', onPointerOver)
      cancelAnimationFrame(rafId)
    }
  }, [])

  if (!active) return null

  return (
    <>
      {/* Dot — outer wrapper translated by rAF, inner scaled by CSS transitions */}
      <div
        ref={dotWrapRef}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }}
      >
        <div
          ref={dotRef}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#1447E6',
            opacity: 0.65,
            // -4px centers the 8px dot on the translate origin
            marginLeft: -4,
            marginTop: -4,
            transition: 'transform 180ms ease, opacity 180ms ease',
            willChange: 'transform',
          }}
        />
      </div>

      {/* Ring — outer wrapper translated by rAF, inner scales in/out on hover */}
      <div
        ref={ringWrapRef}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none' }}
      >
        <div
          ref={ringRef}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '1.5px solid #1447E6',
            opacity: 0,
            // -14px centers the 28px ring on the translate origin
            marginLeft: -14,
            marginTop: -14,
            transform: 'scale(0)',
            transition: 'transform 200ms ease, opacity 200ms ease',
            willChange: 'transform',
          }}
        />
      </div>
    </>
  )
}
