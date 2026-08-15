'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import emailjs from '@emailjs/browser';
import {
  CheckCircle2, ArrowRight, Loader2, AlertTriangle,
  User, Mail, Phone, MapPin, BookOpen, Briefcase, Sparkles, MessageSquare,
} from 'lucide-react';
import { useLeadCapture } from '@/components/lead-capture/useLeadCapture';
import { submitRegistration } from '@/lib/services/registrations/client';

/* ── EmailJS (unchanged — now a secondary notification, see handleSubmit) ── */
const EJS_SERVICE          = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!;
const EJS_REGISTER_TEMPLATE = process.env.NEXT_PUBLIC_EMAILJS_REGISTER_TEMPLATE_ID!;
const EJS_KEY              = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!;

/* ── Dropdown data (unchanged) ──────────────────────────────────────────── */
const PROGRAMS = [
  { value: '',                                                       label: 'Select a program…' },
  { value: 'AI Powered Full Stack Dev + DevOps (6 months)',          label: 'AI Powered Full Stack Dev + DevOps (6 months)' },
  { value: 'GenAI Builder → Freelancer Program (3 months)',          label: 'GenAI Builder → Freelancer Program (3 months)' },
  { value: 'Data Science — AI/ML Specialisation (5 months)',         label: 'Data Science — AI/ML Specialisation (5 months)' },
  { value: 'AI Beginner Bootcamp (8 weeks)',                         label: 'AI Beginner Bootcamp (8 weeks)' },
  { value: 'Still deciding — help me choose',                        label: 'Still deciding — help me choose' },
];

/**
 * RC-1: maps this form's descriptive program labels onto the catalog
 * slugs Registration.programSlug expects (the same slugs ContactForm's
 * own dropdown already uses) — undefined for "still deciding," since
 * that visitor hasn't actually chosen a program to register for yet
 * (they still become a Lead, just not a Registration; see handleSubmit).
 */
const PROGRAM_SLUGS: Record<string, string> = {
  'AI Powered Full Stack Dev + DevOps (6 months)': 'full-stack-devops',
  'GenAI Builder → Freelancer Program (3 months)': 'genai-builder',
  'Data Science — AI/ML Specialisation (5 months)': 'data-science',
  'AI Beginner Bootcamp (8 weeks)': 'bootcamp',
};

const BACKGROUNDS = [
  { value: '',                               label: 'Select your background…' },
  { value: 'Student (BE / BCS / MCS)',       label: 'Student (BE / BCS / MCS)' },
  { value: 'Working Professional (0–2 yrs)', label: 'Working Professional (0–2 yrs)' },
  { value: 'Working Professional (2+ yrs)',  label: 'Working Professional (2+ yrs)' },
  { value: 'Career switcher',               label: 'Career switcher' },
  { value: 'Other',                         label: 'Other' },
];

type Fields = {
  name: string; email: string; phone: string; city: string;
  program: string; goal: string; background: string; blocker: string;
};

/* ── Custom select chevron ──────────────────────────────────────────────── */
const selectChevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2371717a' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`;

/* ── Label with icon ────────────────────────────────────────────────────── */
function Label({
  htmlFor, icon: Icon, children, optional = false,
}: {
  htmlFor: string;
  icon: React.ElementType;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-1.5 text-sm font-semibold mb-1.5"
      style={{ color: 'var(--ls-text)' }}
    >
      <Icon size={13} style={{ color: 'var(--ls-blue-primary)', flexShrink: 0 }} />
      {children}
      {!optional && <span style={{ color: '#dc2626' }}> *</span>}
      {optional && (
        <span className="ml-1 font-normal" style={{ color: 'var(--ls-muted)' }}>(optional)</span>
      )}
    </label>
  );
}

/* ── Blue left panel ────────────────────────────────────────────────────── */
function LeftPanel({ noMotion }: { noMotion: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: noMotion ? 0 : -28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.0, 0.0, 0.2, 1.0] }}
      className="flex flex-col px-8 py-10 lg:px-12 lg:py-16 xl:px-16 xl:py-20"
      style={{
        background: 'linear-gradient(160deg, #1447E6 0%, #0B1F66 100%)',
        minHeight: 220,
      }}
    >
      {/* Brand label */}
      <p
        className="mb-8 lg:mb-12"
        style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        LearnSynaptic
      </p>

      {/* Headline */}
      <div className="flex-1">
        <h2
          style={{
            color: '#fff',
            fontSize: 'clamp(1.375rem, 2.6vw, 1.875rem)',
            fontWeight: 500,
            lineHeight: 1.38,
            letterSpacing: '-0.01em',
            maxWidth: 360,
            marginBottom: '1.125rem',
          }}
        >
          Where do you want to be in 12 months?
        </h2>

        <p
          className="hidden lg:block"
          style={{
            color: 'rgba(255,255,255,0.72)',
            fontSize: '0.9375rem',
            lineHeight: 1.75,
            maxWidth: 320,
          }}
        >
          Tell us your goal. We&apos;ll show you the exact program and path
          to get there — no guesswork.
        </p>
      </div>

      {/* Stats */}
      <div
        className="flex items-center mt-10"
        style={{ borderTop: '1px solid rgba(255,255,255,0.14)', paddingTop: '1.5rem' }}
      >
        <div className="flex-1">
          <div style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>5+</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', marginTop: 5, lineHeight: 1.4 }}>
            Batches run
          </div>
        </div>
        <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.18)', margin: '0 28px', flexShrink: 0 }} />
        <div className="flex-1">
          <div style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>90%</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', marginTop: 5, lineHeight: 1.4 }}>
            Placement rate
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * RC-1: staggered row wrapper — hoisted to module scope. It previously
 * lived inside RegisterForm's render body, which meant a brand-new
 * function reference was created on every re-render (every keystroke,
 * since typing updates `fields` state). React treats each render's
 * `<Row>` as a different component type in the same tree position and
 * unmounts + remounts the whole subtree — including the actual <input>
 * DOM node — on every single keystroke. That silently dropped typed
 * text (confirmed with a real browser: after "filling" every field,
 * every text input read back empty) — this was a genuine, user-facing
 * data-loss bug on the site's main registration form, not just the
 * "components created during render" lint warning it also happened to
 * trip. Calls useReducedMotion() itself rather than threading it down
 * as a prop through all seven call sites — same value, smaller diff.
 */
function Row({ delay, children }: { delay: number; children: React.ReactNode }) {
  const noMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: noMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: noMotion ? 0 : delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════════════════════════ */
export function RegisterForm() {
  const noMotion = useReducedMotion();
  const [focused, setFocused] = useState<string | null>(null);
  const { status, submit } = useLeadCapture();
  const [fields, setFields] = useState<Fields>({
    name: '', email: '', phone: '', city: '',
    program: '', goal: '', background: '', blocker: '',
  });

  const set = (k: keyof Fields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFields(f => ({ ...f, [k]: e.target.value }));

  const canSubmit = !!(
    fields.name.trim() && fields.email.trim() && fields.phone.trim() &&
    fields.city.trim() && fields.program && fields.goal.trim() && fields.background
  );

  /**
   * RC-1: /api/leads is now the primary, awaited call — its result
   * decides success/error, not EmailJS. A program selection that maps
   * to a real catalog slug also creates a Registration (this is the
   * one form on the site that represents an actual "sign me up for
   * program X" intent, as opposed to a general inquiry — see
   * PROGRAM_SLUGS above). EmailJS keeps sending the same notification
   * it always has, now as a best-effort secondary step.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || status === 'sending') return;

    const result = await submit({
      lead: {
        name: fields.name,
        email: fields.email,
        phone: fields.phone,
        program: fields.program,
        source: 'register-page',
        message: [
          `City: ${fields.city}`,
          `Background: ${fields.background}`,
          `Goal: ${fields.goal}`,
          fields.blocker ? `Blocker: ${fields.blocker}` : null,
        ].filter(Boolean).join(' | '),
      },
      analyticsEvent: 'CompleteRegistration',
      analyticsParams: { formName: 'RegisterForm', program: fields.program, background: fields.background },
      notify: () =>
        emailjs.send(
          EJS_SERVICE,
          EJS_REGISTER_TEMPLATE,
          {
            name:       fields.name,
            email:      fields.email,
            phone:      fields.phone,
            city:       fields.city,
            program:    fields.program,
            goal:       fields.goal,
            background: fields.background,
            blocker:    fields.blocker || '(not answered)',
          },
          EJS_KEY,
        ),
    });

    const programSlug = PROGRAM_SLUGS[fields.program];
    if (result.success && result.leadId && programSlug) {
      const registrationResult = await submitRegistration({
        leadId: result.leadId,
        programSlug,
        programName: fields.program,
        source: 'register-page',
      });
      if (!registrationResult.success) {
        console.error('[RegisterForm] /api/registrations failed (lead was still created):', registrationResult.errors);
      }
    }
  };

  /* ── Inline field style helpers ─────────────────────────────────────── */
  const isFocused = (k: string) => focused === k;

  const fi = (k: string): React.CSSProperties => ({
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1.5px solid ${isFocused(k) ? '#1447E6' : 'var(--ls-border)'}`,
    background: '#fff',
    color: 'var(--ls-text)',
    fontSize: '0.9375rem',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    boxShadow: isFocused(k) ? '0 0 0 3px rgba(20,71,230,0.10)' : 'none',
  });

  const si = (k: string): React.CSSProperties => ({
    ...fi(k),
    backgroundImage: selectChevron,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: 36,
    appearance: 'none' as const,
    cursor: 'pointer',
  });

  const ti = (k: string): React.CSSProperties => ({
    ...fi(k),
    background: 'rgba(239,246,255,0.65)',
    border: `1.5px solid ${isFocused(k) ? '#1447E6' : 'rgba(20,71,230,0.15)'}`,
    resize: 'none' as const,
    lineHeight: 1.65,
  });

  /* ── Success state ─────────────────────────────────────────────────── */
  if (status === 'success') {
    return (
      <div
        className="lg:grid lg:grid-cols-[41%_59%]"
        style={{ minHeight: 'calc(100vh - 80px)' }}
      >
        <LeftPanel noMotion={!!noMotion} />

        <div
          className="flex items-center justify-center px-8 py-16"
          style={{ background: '#fff' }}
        >
          <motion.div
            initial={{ opacity: 0, y: noMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center"
            style={{ maxWidth: 420, width: '100%' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'var(--ls-blue-tint)' }}
            >
              <CheckCircle2 size={30} style={{ color: 'var(--ls-blue-primary)' }} strokeWidth={2} />
            </div>

            <h2
              className="mb-3"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', letterSpacing: '-0.02em' }}
            >
              You&apos;re on the list.
            </h2>

            <p style={{ color: 'var(--ls-muted)', lineHeight: 1.8, fontSize: '1rem', maxWidth: 360, margin: '0 auto' }}>
              We&apos;ll reach out within 24 hours to map out your path. Watch
              your WhatsApp — we&apos;ll come to you directly.
            </p>

            <div
              className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-center gap-3"
              style={{ borderTop: '1px solid var(--ls-border)' }}
            >
              <Link href="/" className="ls-btn-outline" style={{ fontSize: '0.875rem' }}>
                Back to home
              </Link>
              <a
                href="https://instagram.com/learnsynaptic"
                target="_blank"
                rel="noopener noreferrer"
                className="ls-btn-primary"
                style={{ fontSize: '0.875rem' }}
              >
                Follow @learnsynaptic <ArrowRight size={14} />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── Form state ────────────────────────────────────────────────────── */
  return (
    <div
      className="lg:grid lg:grid-cols-[41%_59%]"
      style={{ minHeight: 'calc(100vh - 80px)' }}
    >
      <LeftPanel noMotion={!!noMotion} />

      {/* Right panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, delay: noMotion ? 0 : 0.2, ease: 'easeOut' }}
        className="px-6 py-10 sm:px-10 lg:px-12 lg:py-14 xl:px-16 xl:py-16"
        style={{ background: '#fff' }}
      >
        {/* Panel header */}
        <div className="mb-8">
          <h3 style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--ls-text)', marginBottom: 4 }}>
            Start your registration
          </h3>
          <p style={{ color: 'var(--ls-muted)', fontSize: '0.875rem' }}>
            Takes about 2 minutes.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* 1 + 2: Full Name & Email */}
          <Row delay={0.28}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <Label htmlFor="r-name" icon={User}>Full name</Label>
                <input
                  id="r-name" type="text" required
                  placeholder="Riya Deshmukh"
                  value={fields.name} onChange={set('name')}
                  onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                  style={fi('name')}
                />
              </div>
              <div>
                <Label htmlFor="r-email" icon={Mail}>Email address</Label>
                <input
                  id="r-email" type="email" required
                  placeholder="you@gmail.com"
                  value={fields.email} onChange={set('email')}
                  onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                  style={fi('email')}
                />
              </div>
            </div>
          </Row>

          {/* 3 + 8: WhatsApp & City */}
          <Row delay={0.34}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <Label htmlFor="r-phone" icon={Phone}>
                  WhatsApp number
                  <span className="ml-1 font-normal" style={{ color: 'var(--ls-muted)', fontSize: '0.78rem' }}>
                    (we&apos;ll reach out here)
                  </span>
                </Label>
                <input
                  id="r-phone" type="tel" required
                  placeholder="+91 98765 43210"
                  value={fields.phone} onChange={set('phone')}
                  onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
                  style={fi('phone')}
                />
              </div>
              <div>
                <Label htmlFor="r-city" icon={MapPin}>City</Label>
                <input
                  id="r-city" type="text" required
                  placeholder="Pune"
                  value={fields.city} onChange={set('city')}
                  onFocus={() => setFocused('city')} onBlur={() => setFocused(null)}
                  style={fi('city')}
                />
              </div>
            </div>
          </Row>

          {/* 4: Program */}
          <Row delay={0.40}>
            <div className="mb-5">
              <Label htmlFor="r-program" icon={BookOpen}>
                Which program are you exploring?
              </Label>
              <select
                id="r-program" required
                value={fields.program} onChange={set('program')}
                onFocus={() => setFocused('program')} onBlur={() => setFocused(null)}
                style={si('program')}
              >
                {PROGRAMS.map(({ value, label }) => (
                  <option key={value} value={value} disabled={!value}>{label}</option>
                ))}
              </select>
            </div>
          </Row>

          {/* 5: Background */}
          <Row delay={0.46}>
            <div className="mb-5">
              <Label htmlFor="r-background" icon={Briefcase}>
                What&apos;s your current background?
              </Label>
              <select
                id="r-background" required
                value={fields.background} onChange={set('background')}
                onFocus={() => setFocused('background')} onBlur={() => setFocused(null)}
                style={si('background')}
              >
                {BACKGROUNDS.map(({ value, label }) => (
                  <option key={value} value={value} disabled={!value}>{label}</option>
                ))}
              </select>
            </div>
          </Row>

          {/* 6: Goal textarea — tinted */}
          <Row delay={0.52}>
            <div className="mb-5">
              <Label htmlFor="r-goal" icon={Sparkles}>
                Where do you want to be in 12 months?
              </Label>
              <textarea
                id="r-goal" required rows={3}
                placeholder="A specific role, a company, a skill you want to master..."
                value={fields.goal} onChange={set('goal')}
                onFocus={() => setFocused('goal')} onBlur={() => setFocused(null)}
                style={ti('goal')}
              />
            </div>
          </Row>

          {/* 7: Blocker textarea — tinted, optional */}
          <Row delay={0.58}>
            <div className="mb-7">
              <Label htmlFor="r-blocker" icon={MessageSquare} optional>
                What&apos;s stopped you from starting until now?
              </Label>
              <p className="text-xs mb-1.5" style={{ color: 'var(--ls-muted)', lineHeight: 1.6 }}>
                Honestly useful for our first call — and useful for you to put into words.
              </p>
              <textarea
                id="r-blocker" rows={2}
                placeholder="Time, cost, not knowing where to start, impostor syndrome..."
                value={fields.blocker} onChange={set('blocker')}
                onFocus={() => setFocused('blocker')} onBlur={() => setFocused(null)}
                style={ti('blocker')}
              />
            </div>
          </Row>

          {/* Error banner */}
          {status === 'error' && (
            <div
              className="flex items-start gap-3 rounded-xl p-4 mb-5"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
            >
              <AlertTriangle size={17} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.875rem' }}>
                  Submission failed. Please try again.
                </p>
                <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: 3 }}>
                  Or{' '}
                  <a
                    href="https://wa.me/919763969449"
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontWeight: 600, textDecoration: 'underline' }}
                  >
                    WhatsApp us directly
                  </a>{' '}
                  — we&apos;ll register you manually.
                </p>
              </div>
            </div>
          )}

          {/* Submit */}
          <Row delay={0.64}>
            <button
              type="submit"
              disabled={!canSubmit || status === 'sending'}
              className="ls-btn-primary w-full justify-center"
              style={{
                padding: '0.9375rem 2rem',
                fontSize: '1rem',
                fontWeight: 700,
                borderRadius: '0.625rem',
                letterSpacing: '-0.01em',
                opacity: canSubmit && status !== 'sending' ? 1 : 0.42,
                cursor: canSubmit && status !== 'sending' ? 'pointer' : 'not-allowed',
              }}
            >
              {status === 'sending' ? (
                <><Loader2 size={16} className="animate-spin" /> Submitting…</>
              ) : (
                <>Start My Path <ArrowRight size={16} /></>
              )}
            </button>

            <p className="mt-4 text-center text-xs" style={{ color: 'var(--ls-muted)', lineHeight: 1.6 }}>
              No spam. We reach out once to map out your path — your call after that.
            </p>
          </Row>
        </form>
      </motion.div>
    </div>
  );
}
