'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

const enrolledPrograms = [
  'AI Powered Full Stack Dev + DevOps',
  'GenAI Builder → Freelancer Program',
  'Data Science — AI/ML Specialisation',
  'AI Beginner Bootcamp',
  "I'm not enrolled yet — exploring options",
]

interface FormState {
  name: string
  email: string
  phone: string
  program: string
  buildNote: string
}

export function InternshipApplyForm() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    program: '',
    buildNote: '',
  })
  const [submitted, setSubmitted] = useState(false)

  function onChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: wire to CRM / email integration
    setSubmitted(true)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1.5px solid var(--ls-border)',
    fontSize: '0.9375rem',
    color: 'var(--ls-text)',
    background: '#fff',
    outline: 'none',
    transition: 'border-color 150ms',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.825rem',
    fontWeight: 600,
    color: 'var(--ls-text)',
    marginBottom: 5,
  }

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--ls-blue-tint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <CheckCircle2 size={28} color="var(--ls-blue-primary)" strokeWidth={2} />
        </div>
        <h3 style={{ color: 'var(--ls-text)', marginBottom: 8, fontSize: '1.3rem', fontWeight: 700 }}>
          Application received
        </h3>
        <p style={{ color: 'var(--ls-muted)', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
          Pratik will review your application and follow up within 2 business days to discuss your project
          brief and confirm your eligibility.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="it-name" style={labelStyle}>Full name</label>
          <input
            id="it-name"
            name="name"
            type="text"
            required
            placeholder="Priya Sharma"
            value={form.name}
            onChange={onChange}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = 'var(--ls-blue-primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--ls-border)')}
          />
        </div>
        <div>
          <label htmlFor="it-email" style={labelStyle}>Email address</label>
          <input
            id="it-email"
            name="email"
            type="email"
            required
            placeholder="priya@email.com"
            value={form.email}
            onChange={onChange}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = 'var(--ls-blue-primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--ls-border)')}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="it-phone" style={labelStyle}>Phone number</label>
          <input
            id="it-phone"
            name="phone"
            type="tel"
            required
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={onChange}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = 'var(--ls-blue-primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--ls-border)')}
          />
        </div>
        <div>
          <label htmlFor="it-program" style={labelStyle}>Program you&apos;re enrolled in</label>
          <select
            id="it-program"
            name="program"
            required
            value={form.program}
            onChange={onChange}
            style={{
              ...inputStyle,
              color: form.program ? 'var(--ls-text)' : 'var(--ls-muted)',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2371717a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
              paddingRight: 36,
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--ls-blue-primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--ls-border)')}
          >
            <option value="" disabled>Select your program…</option>
            {enrolledPrograms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="it-build" style={labelStyle}>
          Briefly describe what you want to build{' '}
          <span style={{ fontWeight: 400, color: 'var(--ls-muted)' }}>(1–3 sentences)</span>
        </label>
        <textarea
          id="it-build"
          name="buildNote"
          required
          rows={4}
          placeholder="e.g. I want to build a RAG-based tool that helps a local business answer customer queries from their product documentation. I have the basic RAG concepts down from the course and want to deploy a working version."
          value={form.buildNote}
          onChange={onChange}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--ls-blue-primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--ls-border)')}
        />
      </div>

      <div>
        <button
          type="submit"
          className="ls-btn-primary"
          style={{ justifyContent: 'center', padding: '13px 32px' }}
        >
          Submit Application
        </button>
        <p style={{ fontSize: '0.8rem', color: 'var(--ls-muted)', marginTop: 10, lineHeight: 1.5 }}>
          Pratik reviews every application personally and responds within 2 business days.
        </p>
      </div>
    </form>
  )
}
