'use client'

import { useEffect, useRef, useState } from 'react'

const SIZE = 130

export function SpotlightGlow() {
  const [active, setActive] = useState(false)
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!hasMouse || prefersReduced) return

    // Defer activation so setState isn't synchronous in the effect body.
    const activateId = requestAnimationFrame(() => setActive(true))

    let targetX = 0
    let targetY = 0
    let curX = 0
    let curY = 0
    let hasFirstMove = false
    let rafId: number
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null

    function show() {
      if (glowRef.current) glowRef.current.style.opacity = '1'
    }

    function hide() {
      if (glowRef.current) glowRef.current.style.opacity = '0'
    }

    function scheduleHide() {
      if (inactivityTimer !== null) clearTimeout(inactivityTimer)
      inactivityTimer = setTimeout(hide, 1500)
    }

    function tick() {
      if (hasFirstMove) {
        // 0.08 lerp factor — slightly slower than the cursor dot for a trailing glow feel
        curX += (targetX - curX) * 0.08
        curY += (targetY - curY) * 0.08

        if (glowRef.current) {
          glowRef.current.style.transform = `translate(${curX}px, ${curY}px)`
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    function onMouseMove(e: MouseEvent) {
      if (!hasFirstMove) {
        // Snap to cursor on first move so glow doesn't lerp in from off-screen
        curX = e.clientX
        curY = e.clientY
        hasFirstMove = true
      }
      targetX = e.clientX
      targetY = e.clientY
      show()
      scheduleHide()
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(activateId)
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(rafId)
      if (inactivityTimer !== null) clearTimeout(inactivityTimer)
    }
  }, [])

  if (!active) return null

  return (
    <div
      ref={glowRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(20, 71, 230, 0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 9000,
        marginLeft: -(SIZE / 2),
        marginTop: -(SIZE / 2),
        opacity: 0,
        transition: 'opacity 400ms ease',
        willChange: 'transform',
      }}
    />
  )
}
