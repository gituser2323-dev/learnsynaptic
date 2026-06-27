'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Play, Pause, Loader2, ArrowRight } from 'lucide-react'
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll'

const testimonials = [
  {
    id: 't1',
    studentName: 'Sumit M',
    program: 'AI Full Stack Dev — now SDE',
    videoSrc: '/gallery/t1.mp4',
    posterSrc: '/gallery/t1-poster.jpg',
  },
  {
    id: 't2',
    studentName: 'Akash P',
    program: 'AI Full Stack Dev',
    videoSrc: '/gallery/t2.mp4',
    posterSrc: '/gallery/t2-poster.jpg',
  },
]

function VideoCard({
  t,
  isActive,
  onActivate,
}: {
  t: (typeof testimonials)[0]
  isActive: boolean
  onActivate: (id: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const playPromiseRef = useRef<Promise<void> | null>(null)

  const showPoster = !hasStarted && Boolean(t.posterSrc) && !posterFailed

  useEffect(() => {
    const video = videoRef.current
    if (!isActive && video && !video.paused) {
      const pending = playPromiseRef.current
      if (pending) {
        pending.catch(() => {}).finally(() => { video.pause() })
      } else {
        video.pause()
      }
      setIsPlaying(false)
    }
  }, [isActive])

  useEffect(() => {
    const video = videoRef.current
    return () => {
      if (video) { video.pause(); video.removeAttribute('src'); video.load() }
    }
  }, [])

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) { video.pause(); setIsPlaying(false); return }
    onActivate(t.id)
    if (!hasStarted) { setIsLoading(true); setHasStarted(true) }
    const p = video.play()
    playPromiseRef.current = p
    if (p !== undefined) {
      p.then(() => { setIsPlaying(true); setIsLoading(false) })
        .catch((err) => {
          if (err?.name !== 'AbortError') console.error('Playback failed:', err)
          setIsLoading(false); setIsPlaying(false)
        })
        .finally(() => { playPromiseRef.current = null })
    }
  }, [isPlaying, hasStarted, onActivate, t.id])

  return (
    <div className="relative">
      <div
        className="relative w-full overflow-hidden rounded-[20px] bg-slate-900"
        style={{
          aspectRatio: '4/5',
          boxShadow: '0 16px 40px -12px rgba(20,71,230,0.25)',
        }}
      >
        {showPoster && (
          <img
            src={t.posterSrc}
            alt=""
            aria-hidden
            onError={() => setPosterFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        <video
          ref={videoRef}
          src={t.videoSrc}
          playsInline
          preload="metadata"
          onCanPlay={() => setIsLoading(false)}
          onEnded={() => setIsPlaying(false)}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => setIsLoading(false)}
          onPause={() => setIsPlaying(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${hasStarted ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Corner brackets — same accent as full VideoTestimonialsSection */}
        <div className="pointer-events-none absolute inset-3 z-10">
          <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-white/40" />
          <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-white/40" />
          <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-white/40" />
          <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-white/40" />
        </div>
        <div className="absolute left-4 top-4 z-10 h-[2px] w-7 bg-[#1447E6]" />

        {!isPlaying && <div className="absolute inset-0 z-10 bg-black/15" />}

        {isLoading ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
            <Loader2 className="h-9 w-9 animate-spin text-white" aria-hidden />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
            className={`absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#1447E6] shadow-lg transition-all duration-200 hover:scale-110 ${isPlaying ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
          >
            <Play className="h-6 w-6 fill-white text-white" aria-hidden />
          </button>
        )}

        {!isLoading && isPlaying && (
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-label="Pause video"
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40"
          >
            <Pause className="h-4 w-4 fill-white text-white" aria-hidden />
          </button>
        )}

        <div
          className={`absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-12 transition-opacity duration-300 ${isPlaying ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }}
        >
          <div className="inline-flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/95 px-3 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1447E6]" />
              <p className="text-[15px] font-medium tracking-tight text-[#18181B]">
                {t.studentName}
              </p>
            </div>
            <p className="font-mono text-[10.5px] uppercase tracking-wide text-[#1447E6]">
              {t.program}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function HomepageVideoTeaser() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const handleActivate = useCallback((id: string) => setActiveId(id), [])

  return (
    <section className="ls-section-alt">
      <div className="ls-container">
        <AnimateOnScroll className="text-center mb-10">
          <span className="ls-badge mb-4 inline-flex">Real outcomes</span>
          <h2 className="mb-3">Hear it from our graduates</h2>
          <p style={{ maxWidth: 480, margin: '0 auto', color: 'var(--ls-muted)' }}>
            Not testimonials written for a brochure — actual videos from students who went
            through the program and landed their next role.
          </p>
        </AnimateOnScroll>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-6 mx-auto"
          style={{ maxWidth: 680 }}
        >
          {testimonials.map((t) => (
            <VideoCard
              key={t.id}
              t={t}
              isActive={activeId === t.id}
              onActivate={handleActivate}
            />
          ))}
        </div>

        <AnimateOnScroll className="text-center mt-8">
          <Link href="/placements" className="ls-btn-outline">
            See All Outcomes
            <ArrowRight size={15} />
          </Link>
        </AnimateOnScroll>
      </div>
    </section>
  )
}
