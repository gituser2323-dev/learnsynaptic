'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Loader2, Video as VideoIcon, VideoOff } from 'lucide-react'

interface Testimonial {
  id: string
  studentName: string
  program: string
  videoSrc: string
  posterSrc?: string
}

const testimonials: Testimonial[] = [
  { id: 't1', studentName: 'Sumit Matale',     program: 'AI Full Stack Dev — now SDE', videoSrc: '/gallery/t1.mp4', posterSrc: '/gallery/t1-poster.jpg' },
  { id: 't2', studentName: 'Akash Patil',     program: 'AI Full Stack Dev', videoSrc: '/gallery/t2.mp4', posterSrc: '/gallery/t2-poster.jpg' },
  { id: 't3', studentName: 'Sanket K', program: 'GenAI Builder',    videoSrc: '/gallery/t3.mp4',posterSrc: '/gallery/t3-poster.jpg' },
  { id: 't4', studentName: 'Student Name', program: 'Data Science',     videoSrc: '' },
    { id: 't4', studentName: 'Student Name', program: 'Data Science',     videoSrc: '' },
  { id: 't4', studentName: 'Student Name', program: 'Data Science',     videoSrc: '' },

]

interface CardProps {
  testimonial: Testimonial
  isActive: boolean
  onActivate: (id: string) => void
}

function TestimonialCard({ testimonial, isActive, onActivate }: CardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)

  const hasVideo = Boolean(testimonial.videoSrc)
  const showPoster = hasVideo && !hasStarted && testimonial.posterSrc && !posterFailed
  const showIconFallback = hasVideo && !hasStarted && (!testimonial.posterSrc || posterFailed)

  // Guards against the AbortError race: if play() hasn't resolved yet,
  // we wait for it (and swallow any rejection it causes) before pausing.
  const playPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!isActive && video && !video.paused) {
      const pending = playPromiseRef.current
      if (pending) {
        // A play() call is still in flight — wait for it to settle,
        // then pause. This is what prevents the AbortError.
        pending.catch(() => {}).finally(() => {
          video.pause()
        })
      } else {
        video.pause()
      }
      setIsPlaying(false)
    }
  }, [isActive])

  useEffect(() => {
    const video = videoRef.current
    return () => {
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
    }
  }, [])

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video || !hasVideo) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      return
    }

    onActivate(testimonial.id)
    if (!hasStarted) {
      setIsLoading(true)
      setHasStarted(true)
    }

    const playPromise = video.play()
    playPromiseRef.current = playPromise

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true)
          setIsLoading(false)
        })
        .catch((err) => {
          // AbortError happens when pause() interrupts a pending play() —
          // this is expected when switching between cards quickly, not a
          // real failure. Only log genuine errors.
          if (err?.name !== 'AbortError') {
            console.error('Testimonial video playback failed:', err)
          }
          setIsLoading(false)
          setIsPlaying(false)
        })
        .finally(() => {
          playPromiseRef.current = null
        })
    }
  }, [isPlaying, hasStarted, hasVideo, onActivate, testimonial.id])

  return (
    // No tilt, no transform-on-hover. Flat card, modern tech accents instead.
    <div className="group relative">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px] bg-slate-900 shadow-[0_22px_44px_-12px_rgba(20,71,230,0.3)]">
        {hasVideo ? (
          <>
            {showPoster && (
              <img
                src={testimonial.posterSrc}
                alt=""
                aria-hidden="true"
                onError={() => setPosterFailed(true)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {showIconFallback && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                <VideoIcon className="h-14 w-14 text-slate-400" aria-hidden="true" />
              </div>
            )}

            <video
              ref={videoRef}
              src={testimonial.videoSrc}
              playsInline
              preload="metadata"
              onCanPlay={() => setIsLoading(false)}
              onEnded={() => setIsPlaying(false)}
              onWaiting={() => setIsLoading(true)}
              onPlaying={() => setIsLoading(false)}
              onPause={() => setIsPlaying(false)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${hasStarted ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Tech-style corner brackets — modern accent, no motion required */}
            <div className="pointer-events-none absolute inset-3 z-10">
              <span className="absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-white/40" />
              <span className="absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-white/40" />
              <span className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-white/40" />
              <span className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-white/40" />
            </div>

            {/* Thin accent line that grows on hover — subtle motion confined to one element */}
            <div className="absolute left-5 top-5 z-10 h-[2px] w-8 bg-[#1447E6] transition-all duration-300 group-hover:w-14" />

            {!isPlaying && <div className="absolute inset-0 z-10 bg-black/15" />}

            {isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
                <Loader2 className="h-10 w-10 animate-spin text-white" aria-hidden="true" />
              </div>
            )}

            {!isLoading && (
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
                className={`absolute left-1/2 top-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#1447E6] shadow-lg transition-all duration-200 group-hover:scale-110 ${isPlaying ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
              >
                <Play className="h-7 w-7 fill-white text-white" aria-hidden="true" />
              </button>
            )}

            {!isLoading && isPlaying && (
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label="Pause video"
                className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/40"
              >
                <Pause className="h-5 w-5 fill-white text-white" aria-hidden="true" />
              </button>
            )}

            <div
              className={`absolute inset-x-0 bottom-0 z-10 px-5 pb-5 pt-16 transition-opacity duration-300 ${isPlaying ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }}
            >
              <div className="inline-flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/95 px-4 py-2.5 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1447E6]" />
                  <p className="text-[18px] font-medium tracking-tight text-[#18181B]">
                    {testimonial.studentName}
                  </p>
                </div>
                <p className="font-mono text-[11.5px] uppercase tracking-wide text-[#1447E6]">
                  {testimonial.program}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-slate-300 bg-slate-50">
            <VideoOff className="h-9 w-9 text-slate-400" aria-hidden="true" />
            <span className="text-[14px] text-slate-400">Coming soon</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VideoTestimonials() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const handleActivate = useCallback((id: string) => setActiveId(id), [])

  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-4">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {testimonials.map((t) => (
            <TestimonialCard
              key={t.id}
              testimonial={t}
              isActive={activeId === t.id}
              onActivate={handleActivate}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
