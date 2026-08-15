'use client';

import { useState } from 'react';
import emailjs from '@emailjs/browser';
import { CheckCircle2, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { useLeadCapture } from '@/components/lead-capture/useLeadCapture';
import { syntheticEmailFromPhone } from '@/lib/services/leads/phoneOnlyEmail';

const EJS_SERVICE = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!;
const EJS_TEMPLATE = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!;
const EJS_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!;

const programs = [
  { value: '', label: 'Which program are you interested in?' },
  { value: 'full-stack-devops', label: 'AI Powered Full Stack Dev + DevOps (6 months)' },
  { value: 'genai-builder', label: 'GenAI Builder → Freelancer Program (3 months)' },
  { value: 'data-science', label: 'Data Science — AI/ML Specialisation (5 months)' },
  { value: 'bootcamp', label: 'AI Beginner Bootcamp (8 weeks)' },
  { value: 'not-sure', label: "Not sure yet — help me choose" },
];

/* ── Shared field style ─────────────────────────────────────────────────── */
const fieldClass =
  'w-full px-4 py-3 rounded-xl border text-[0.9375rem] outline-none transition-colors';
const fieldStyle = {
  borderColor: 'var(--ls-border)',
  color: 'var(--ls-text)',
  background: '#fff',
};
const focusStyle = { borderColor: 'var(--ls-blue-primary)' };

/* ── Main contact form ──────────────────────────────────────────────────── */
export function ContactForm() {
  const [fields, setFields] = useState({
    name: '', email: '', phone: '', program: '', message: '',
  });
  const { status, submit } = useLeadCapture();
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const set = (k: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFields((f) => ({ ...f, [k]: e.target.value }));

  /* RC-1: /api/leads is now the primary, awaited call; EmailJS is a
   * best-effort secondary notification — see useLeadCapture.ts. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit({
      lead: {
        name: fields.name,
        email: fields.email,
        phone: fields.phone,
        program: fields.program || undefined,
        source: 'contact-page',
        message: fields.message,
      },
      analyticsEvent: 'Lead',
      analyticsParams: { formName: 'ContactForm', program: fields.program || 'not-specified' },
      notify: () =>
        emailjs.send(
          EJS_SERVICE,
          EJS_TEMPLATE,
          {
            name: fields.name,
            email: fields.email,
            phone: fields.phone,
            program: fields.program || 'Not specified',
            message: fields.message,
          },
          EJS_KEY,
        ),
    });
  };

  if (status === 'success') {
    return (
      <div
        className="rounded-2xl border p-8 flex flex-col items-start gap-4"
        style={{ borderColor: 'var(--ls-border)', background: '#fff' }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: 'var(--ls-blue-tint)' }}
        >
          <CheckCircle2 size={24} style={{ color: 'var(--ls-blue-primary)' }} />
        </div>
        <div>
          <h3 className="mb-1" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
            Thanks! We&apos;ll be in touch within 24 hours.
          </h3>
          <p style={{ color: 'var(--ls-muted)', maxWidth: 420, lineHeight: 1.7 }}>
            We typically respond within a few hours. If you&apos;d like a quicker response,
            reach out on Instagram{' '}
            <a
              href="https://instagram.com/learnsynaptic"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--ls-blue-primary)', fontWeight: 600 }}
            >
              @learnsynaptic
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border p-7 lg:p-8"
      style={{ borderColor: 'var(--ls-border)', background: '#fff' }}
      noValidate
    >
      <h2 className="mb-6" style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)', letterSpacing: '-0.01em' }}>
        Send us a message
      </h2>

      {status === 'error' && (
        <div
          className="flex items-start gap-3 rounded-xl p-4 mb-5"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
        >
          <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.9rem' }}>
              Something went wrong — please try again.
            </p>
            <p style={{ color: '#b91c1c', fontSize: '0.825rem', marginTop: 2 }}>
              Or{' '}
              <a
                href="https://wa.me/919119421273"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 600, textDecoration: 'underline' }}
              >
                WhatsApp us directly
              </a>
              .
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label
            htmlFor="cf-name"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--ls-text)' }}
          >
            Full name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="cf-name"
            type="text"
            required
            placeholder="Your name"
            value={fields.name}
            onChange={set('name')}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            className={fieldClass}
            style={{ ...fieldStyle, ...(focusedField === 'name' ? focusStyle : {}) }}
          />
        </div>
        <div>
          <label
            htmlFor="cf-email"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--ls-text)' }}
          >
            Email address <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="cf-email"
            type="email"
            required
            placeholder="you@email.com"
            value={fields.email}
            onChange={set('email')}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            className={fieldClass}
            style={{ ...fieldStyle, ...(focusedField === 'email' ? focusStyle : {}) }}
          />
        </div>
      </div>

      <div className="mb-4">
        <label
          htmlFor="cf-phone"
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--ls-text)' }}
        >
          Phone number <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          id="cf-phone"
          type="tel"
          required
          placeholder="+91 98765 43210"
          value={fields.phone}
          onChange={set('phone')}
          onFocus={() => setFocusedField('phone')}
          onBlur={() => setFocusedField(null)}
          className={fieldClass}
          style={{ ...fieldStyle, ...(focusedField === 'phone' ? focusStyle : {}) }}
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="cf-program"
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--ls-text)' }}
        >
          Interested program
        </label>
        <select
          id="cf-program"
          value={fields.program}
          onChange={set('program')}
          onFocus={() => setFocusedField('program')}
          onBlur={() => setFocusedField(null)}
          className={fieldClass}
          style={{
            ...fieldStyle,
            ...(focusedField === 'program' ? focusStyle : {}),
            cursor: 'pointer',
          }}
        >
          {programs.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label
          htmlFor="cf-message"
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--ls-text)' }}
        >
          Message <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <textarea
          id="cf-message"
          required
          rows={4}
          placeholder="Tell us about your background and what you're hoping to achieve..."
          value={fields.message}
          onChange={set('message')}
          onFocus={() => setFocusedField('message')}
          onBlur={() => setFocusedField(null)}
          className={fieldClass}
          style={{
            ...fieldStyle,
            ...(focusedField === 'message' ? focusStyle : {}),
            resize: 'vertical',
            minHeight: 100,
          }}
        />
      </div>

      <button
        type="submit"
        disabled={status === 'sending'}
        className="ls-btn-primary w-full justify-center"
        style={{ opacity: status === 'sending' ? 0.7 : 1 }}
      >
        {status === 'sending' ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sending…
          </>
        ) : (
          <>
            Send Message
            <ArrowRight size={15} />
          </>
        )}
      </button>
    </form>
  );
}

/* ── Request a callback form ────────────────────────────────────────────── */
const timeslots = [
  { value: '', label: 'Preferred callback time' },
  { value: 'morning', label: 'Morning (9 AM – 12 PM)' },
  { value: 'afternoon', label: 'Afternoon (12 PM – 4 PM)' },
  { value: 'evening', label: 'Evening (4 PM – 8 PM)' },
  { value: 'weekend', label: 'Weekend — any time' },
];

export function CallbackForm() {
  const [fields, setFields] = useState({ name: '', phone: '', time: '' });
  const { status, submit } = useLeadCapture();
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const set = (k: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields((f) => ({ ...f, [k]: e.target.value }));

  /* RC-1: this form only ever collected name/phone — no email field, by
   * design (a callback request is inherently phone-first). Lead.email
   * is required, so a clearly-marked, non-deliverable placeholder is
   * synthesized from the phone number rather than adding a field to a
   * form that was intentionally kept minimal. See phoneOnlyEmail.ts. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit({
      lead: {
        name: fields.name,
        email: syntheticEmailFromPhone(fields.phone),
        phone: fields.phone,
        source: 'contact-page-callback',
        message: `Callback request — preferred time: ${fields.time || 'Any time'}`,
      },
      analyticsEvent: 'Lead',
      analyticsParams: { formName: 'CallbackForm', preferredTime: fields.time || 'any' },
      notify: () =>
        emailjs.send(
          EJS_SERVICE,
          EJS_TEMPLATE,
          {
            name: fields.name,
            phone: fields.phone,
            message: `Callback request — preferred time: ${fields.time || 'Any time'}`,
            email: '',
            program: '',
          },
          EJS_KEY,
        ),
    });
  };

  if (status === 'success') {
    return (
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--ls-blue-tint)' }}
        >
          <CheckCircle2 size={20} style={{ color: 'var(--ls-blue-primary)' }} />
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--ls-text)' }}>
            Callback requested
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--ls-muted)' }}>
            We&apos;ll call you at your preferred time. If we miss you, we&apos;ll follow up by WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {status === 'error' && (
        <div
          className="flex items-start gap-3 rounded-xl p-3 mb-4"
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
        >
          <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>
            Something went wrong.{' '}
            <a
              href="https://wa.me/919119421273"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontWeight: 600, textDecoration: 'underline' }}
            >
              WhatsApp us directly
            </a>
            .
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label htmlFor="cb-name" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ls-text)' }}>
            Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="cb-name"
            type="text"
            required
            placeholder="Your name"
            value={fields.name}
            onChange={set('name')}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            className={fieldClass}
            style={{ ...fieldStyle, ...(focusedField === 'name' ? focusStyle : {}) }}
          />
        </div>
        <div>
          <label htmlFor="cb-phone" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ls-text)' }}>
            Phone <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            id="cb-phone"
            type="tel"
            required
            placeholder="+91 98765 43210"
            value={fields.phone}
            onChange={set('phone')}
            onFocus={() => setFocusedField('phone')}
            onBlur={() => setFocusedField(null)}
            className={fieldClass}
            style={{ ...fieldStyle, ...(focusedField === 'phone' ? focusStyle : {}) }}
          />
        </div>
        <div>
          <label htmlFor="cb-time" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--ls-text)' }}>
            Best time
          </label>
          <select
            id="cb-time"
            value={fields.time}
            onChange={set('time')}
            onFocus={() => setFocusedField('time')}
            onBlur={() => setFocusedField(null)}
            className={fieldClass}
            style={{ ...fieldStyle, ...(focusedField === 'time' ? focusStyle : {}), cursor: 'pointer' }}
          >
            {timeslots.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={status === 'sending'}
        className="ls-btn-primary"
        style={{ opacity: status === 'sending' ? 0.7 : 1 }}
      >
        {status === 'sending' ? (
          <><Loader2 size={15} className="animate-spin" />Requesting…</>
        ) : (
          <>Request Callback<ArrowRight size={15} /></>
        )}
      </button>
    </form>
  );
}
