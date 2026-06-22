'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import emailjs from '@emailjs/browser'

const STORAGE_KEY = 'ls_lead_popup_shown'

const EJS_SERVICE = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!
const EJS_TEMPLATE = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!
const EJS_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!

const programs = [
  'AI Powered Full Stack Dev + DevOps',
  'GenAI Builder → Freelancer Program',
  'Data Science — AI/ML Specialisation',
  'AI Beginner Bootcamp',
  'Not sure yet',
]

const ease = [0.0, 0.0, 0.2, 1.0] as const

export function LeadCapturePopup() {
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [form, setForm] = useState({ name: '', phone: '', program: '' })
  const firedRef = useRef(false)

  // Trigger: 15 s timer OR 50% scroll depth, whichever first; once per session
  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) return

    function show() {
      if (firedRef.current) return
      firedRef.current = true
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      setVisible(true)
      sessionStorage.setItem(STORAGE_KEY, '1')
    }

    const timer = setTimeout(show, 15_000)

    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight
      const total = document.documentElement.scrollHeight
      if (total > 0 && scrolled / total >= 0.5) show()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [visible])

  function handleClose() {
    setVisible(false)
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    try {
      await emailjs.send(
        EJS_SERVICE,
        EJS_TEMPLATE,
        {
          name: form.name,
          phone: form.phone,
          program: form.program || 'Not specified',
          email: '',
          message: `Lead popup enquiry — program interest: ${form.program || 'Not specified'}`,
        },
        EJS_KEY,
      )
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const backdropTransition: Transition = { duration: 0.2, ease }
  const cardTransition: Transition = { duration: 0.28, delay: 0.07, ease }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={backdropTransition}
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 60,
            }}
            aria-hidden="true"
          />

          {/* Card container — full screen flex center, higher z than backdrop */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={cardTransition}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 61,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              pointerEvents: 'none',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                pointerEvents: 'auto',
                background: '#fff',
                borderRadius: 16,
                border: '1px solid var(--ls-border)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
                width: '100%',
                maxWidth: 480,
                padding: '36px 32px 32px',
                position: 'relative',
              }}
            >
              {/* Close button */}
              <button
                onClick={handleClose}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1px solid var(--ls-border)',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--ls-muted)',
                  transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.borderColor = 'var(--ls-blue-primary)'
                  el.style.color = 'var(--ls-blue-primary)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.borderColor = 'var(--ls-border)'
                  el.style.color = 'var(--ls-muted)'
                }}
              >
                <X size={15} />
              </button>

              {status === 'success' ? (
                /* Success state */
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'var(--ls-blue-tint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ls-blue-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 style={{ color: 'var(--ls-text)', marginBottom: 8, fontSize: '1.2rem' }}>
                    Thanks! We&apos;ll be in touch within 24 hours.
                  </h3>
                  <p style={{ color: 'var(--ls-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    Our team will reach out to schedule your free counselling call.
                  </p>
                  <button
                    onClick={handleClose}
                    className="ls-btn-primary"
                    style={{ marginTop: 24, width: '100%', justifyContent: 'center' }}
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Form state */
                <>
                  <div style={{ marginBottom: 24 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        background: 'var(--ls-blue-tint)',
                        color: 'var(--ls-blue-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        padding: '4px 10px',
                        borderRadius: 99,
                        marginBottom: 12,
                      }}
                    >
                      Free offer
                    </span>
                    <h3
                      style={{
                        color: 'var(--ls-text)',
                        fontSize: 'clamp(1.15rem, 3vw, 1.35rem)',
                        fontWeight: 800,
                        lineHeight: 1.25,
                        letterSpacing: '-0.01em',
                        marginBottom: 6,
                      }}
                    >
                      Get program details + a free counselling call
                    </h3>
                    <p style={{ color: 'var(--ls-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      Find the right program for your goals in under 30 minutes — no pressure, no sales pitch.
                    </p>
                  </div>

                  {status === 'error' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 10,
                        padding: '12px 14px',
                        marginBottom: 16,
                      }}
                    >
                      <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
                      <p style={{ color: '#dc2626', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        Something went wrong — please try again or{' '}
                        <a
                          href="https://wa.me/919763969449"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontWeight: 700, textDecoration: 'underline' }}
                        >
                          WhatsApp us directly
                        </a>
                        .
                      </p>
                    </div>
                  )}

                  <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label
                        htmlFor="lcp-name"
                        style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--ls-text)', marginBottom: 5 }}
                      >
                        Your name
                      </label>
                      <input
                        id="lcp-name"
                        name="name"
                        type="text"
                        required
                        placeholder="Ravi Kumar"
                        value={form.name}
                        onChange={onChange}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1.5px solid var(--ls-border)',
                          fontSize: '0.9375rem',
                          color: 'var(--ls-text)',
                          background: '#fff',
                          outline: 'none',
                          transition: 'border-color 150ms',
                        }}
                        onFocus={e => { e.target.style.borderColor = 'var(--ls-blue-primary)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--ls-border)' }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lcp-phone"
                        style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--ls-text)', marginBottom: 5 }}
                      >
                        Phone number
                      </label>
                      <input
                        id="lcp-phone"
                        name="phone"
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={form.phone}
                        onChange={onChange}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1.5px solid var(--ls-border)',
                          fontSize: '0.9375rem',
                          color: 'var(--ls-text)',
                          background: '#fff',
                          outline: 'none',
                          transition: 'border-color 150ms',
                        }}
                        onFocus={e => { e.target.style.borderColor = 'var(--ls-blue-primary)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--ls-border)' }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lcp-program"
                        style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--ls-text)', marginBottom: 5 }}
                      >
                        Which program interests you?
                      </label>
                      <select
                        id="lcp-program"
                        name="program"
                        value={form.program}
                        onChange={onChange}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1.5px solid var(--ls-border)',
                          fontSize: '0.9375rem',
                          color: form.program ? 'var(--ls-text)' : 'var(--ls-muted)',
                          background: '#fff',
                          outline: 'none',
                          transition: 'border-color 150ms',
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2371717a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 14px center',
                          paddingRight: 36,
                        }}
                        onFocus={e => { e.target.style.borderColor = 'var(--ls-blue-primary)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--ls-border)' }}
                      >
                        <option value="" disabled>Select a program…</option>
                        {programs.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={status === 'sending'}
                      className="ls-btn-primary"
                      style={{
                        marginTop: 6,
                        justifyContent: 'center',
                        width: '100%',
                        padding: '13px 24px',
                        opacity: status === 'sending' ? 0.7 : 1,
                      }}
                    >
                      {status === 'sending' ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Sending…
                        </>
                      ) : (
                        'Schedule My Free Call'
                      )}
                    </button>

                    <p style={{ fontSize: '0.76rem', color: 'var(--ls-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                      No spam. Our team will call within 24 hours on weekdays.
                    </p>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
