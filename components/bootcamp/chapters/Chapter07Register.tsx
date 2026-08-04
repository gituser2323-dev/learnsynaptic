'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Loader2, AlertTriangle, CheckCircle2, MessageCircle, Sparkles, Plus, Minus,
} from 'lucide-react';
import { sendBootcampRegistration, type BootcampRegistration } from '@/config/email';
import { useLeadCapture } from '@/components/lead-capture/useLeadCapture';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';
import { Confetti } from '../Confetti';
import { ChapterMark, GridBackdrop, NoiseOverlay, GlowOrbs, Magnetic, BuildersCountdown, TOTAL_SEATS, SEATS_TAKEN } from './primitives';

type FormValues = BootcampRegistration;

const faqs = [
  {
    q: "Is this really free? What's the catch?",
    a: "Yes — no hidden fees, no card required. Students who love the experience often continue into our longer paid programs. There's no obligation to.",
  },
  {
    q: 'I have zero coding experience. Can I join?',
    a: 'You should be comfortable with basic programming concepts to keep pace over 7 days. Complete beginners are better served by our 8-week AI Beginner Bootcamp first.',
  },
  {
    q: 'Are the sessions live or recorded?',
    a: 'All 7 sessions are live with real-time Q&A. Recordings are shared with registered students within 24 hours if you miss one.',
  },
  {
    q: 'Will I actually build something?',
    a: "Yes — by Day 7 you'll have a deployed AI application as your capstone, live at a public link you can share.",
  },
];

const selectChevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23A1A1AA' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`;

function FloatingField({
  id,
  label,
  type = 'text',
  registration,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        placeholder=" "
        className="peer w-full rounded-xl px-4 pt-6 pb-2.5 text-sm outline-none transition-colors duration-200 peer-focus:top-2 peer-focus:text-[11px] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px]"
        style={{
          background: 'rgba(255,255,255,0.045)',
          border: `1px solid ${error ? '#DC2626' : 'var(--b-line-dark)'}`,
          color: 'var(--b-text-onDark)',
        }}
        {...registration}
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-4 text-sm transition-all duration-200 pointer-events-none peer-focus:top-2 peer-focus:text-[11px] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px]"
        style={{ color: 'var(--b-text-onDark-muted)' }}
      >
        {label}
      </label>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: '#F87171' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function FloatingTextarea({
  id,
  label,
  registration,
  error,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div className="relative">
      <textarea
        id={id}
        rows={3}
        placeholder=" "
        className="peer w-full rounded-xl px-4 pt-6 pb-2.5 text-sm outline-none transition-colors duration-200 resize-none"
        style={{
          background: 'rgba(255,255,255,0.045)',
          border: `1px solid ${error ? '#DC2626' : 'var(--b-line-dark)'}`,
          color: 'var(--b-text-onDark)',
          lineHeight: 1.6,
        }}
        {...registration}
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-4 text-sm transition-all duration-200 pointer-events-none peer-focus:top-2 peer-focus:text-[11px] peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[11px]"
        style={{ color: 'var(--b-text-onDark-muted)' }}
      >
        {label}
      </label>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: '#F87171' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function FloatingSelect({
  id,
  label,
  registration,
  error,
  options,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  options: string[];
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block mb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--b-text-onDark-muted)' }}
      >
        {label}
      </label>
      <select
        id={id}
        defaultValue=""
        className="w-full rounded-xl px-4 py-3.5 text-sm outline-none appearance-none cursor-pointer"
        style={{
          background: 'rgba(255,255,255,0.045)',
          border: `1px solid ${error ? '#DC2626' : 'var(--b-line-dark)'}`,
          color: 'var(--b-text-onDark)',
          backgroundImage: selectChevron,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 14px center',
          paddingRight: 36,
        }}
        {...registration}
      >
        <option value="" disabled style={{ color: '#000' }}>
          Select one…
        </option>
        {options.map((o) => (
          <option key={o} value={o} style={{ color: '#000' }}>
            {o}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: '#F87171' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function SuccessScreen() {
  const shouldReduce = useReducedMotion();
  return (
    <>
      <Confetti colors={['#165DFC', '#5B8CFF', '#22C55E', '#F5F6F8']} />
      <motion.div
        initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center py-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(22,93,252,0.15)' }}
        >
          <CheckCircle2 size={38} style={{ color: 'var(--b-blue-soft)' }} strokeWidth={2} />
        </motion.div>

        <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: 12 }}>Welcome, Builder.</h2>
        <p className="b-muted" style={{ lineHeight: 1.75, maxWidth: 420, margin: '0 auto' }}>
          You&apos;ve officially reserved your seat. We&apos;ll send the live session link to
          your email and WhatsApp before Day 1 begins. Your AI journey starts now.
        </p>

        <div
          className="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-center gap-3"
          style={{ borderTop: '1px solid var(--b-line-dark)' }}
        >
          <a
            href="https://chat.whatsapp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="b-btn-primary"
          >
            <MessageCircle size={16} /> Join the Builders Community
          </a>
          <Link href="/" className="b-btn-ghost">
            Back to home
          </Link>
        </div>
      </motion.div>
    </>
  );
}

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} style={{ borderBottom: '1px solid var(--b-line-dark)' }}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-start justify-between py-5 text-left gap-4"
            >
              <span className="font-semibold text-sm leading-snug">{f.q}</span>
              <span
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                style={{
                  background: isOpen ? 'var(--b-blue)' : 'rgba(255,255,255,0.08)',
                  color: isOpen ? '#fff' : 'var(--b-text-onDark-muted)',
                  transition: 'background 200ms, color 200ms',
                }}
              >
                {isOpen ? <Minus size={12} /> : <Plus size={12} />}
              </span>
            </button>
            {isOpen && (
              <div className="pb-5">
                <p className="b-muted text-sm leading-relaxed" style={{ maxWidth: 560 }}>{f.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ChapterRegister({ target, batchDateLabel }: { target: Date; batchDateLabel: string }) {
  const { status, submit } = useLeadCapture();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ mode: 'onBlur' });

  const values = watch();
  const requiredFields: (keyof FormValues)[] = ['name', 'email', 'phone', 'organisation', 'status', 'skillLevel', 'goal'];
  const filledCount = requiredFields.filter((f) => !!values[f]).length;
  const progressPct = Math.max(4, Math.round((filledCount / requiredFields.length) * 100));

  /* RC-1: /api/leads is now the primary, awaited call; the existing
   * EmailJS-backed sendBootcampRegistration() becomes a best-effort
   * secondary notification. */
  const onSubmit = async (data: FormValues) => {
    await submit({
      lead: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        program: 'AI Beginner Bootcamp — 7-Day Chapter',
        source: 'bootcamp-chapter-register',
        message: `Organisation: ${data.organisation} | Status: ${data.status} | Skill level: ${data.skillLevel} | Goal: ${data.goal}`,
      },
      analyticsEvent: 'CompleteRegistration',
      analyticsParams: { formName: 'ChapterRegister' },
      notify: () => sendBootcampRegistration(data),
    });
  };

  const seatsPct = Math.round((SEATS_TAKEN / TOTAL_SEATS) * 100);

  return (
    <section id="register" className="b-chapter b-chapter-ink" style={{ padding: '112px 0 80px', scrollMarginTop: 90 }}>
      <GridBackdrop />
      <NoiseOverlay />
      <GlowOrbs orbs={[{ top: '-14%', left: '50%', size: 560, color: 'var(--b-blue)', opacity: 0.22 }]} />

      <div className="b-container relative">
        <div className="text-center mb-6">
          <ChapterMark index="11" label="Reserve Your Seat" />
        </div>

        <AnimateOnScroll className="max-w-lg mx-auto text-center mb-14">
          <span className="b-pill mb-5" style={{ display: 'inline-flex' }}>
            <span style={{ width: 6, height: 6, borderRadius: 9999, background: '#22C55E', display: 'inline-block' }} />
            Only {TOTAL_SEATS - SEATS_TAKEN} seats left for this batch
          </span>
          <h2 style={{ fontSize: 'clamp(1.875rem, 3.6vw, 2.75rem)', fontWeight: 800, lineHeight: 1.15 }}>
            Don&apos;t wait for the next cohort.
          </h2>
          <p className="b-muted mt-3" style={{ fontSize: '1rem', lineHeight: 1.7 }}>
            We cap every batch so mentors can give real feedback — not a marketing gimmick.
          </p>

          <div className="mt-7">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ height: '100%', width: `${seatsPct}%`, background: 'var(--b-blue)', borderRadius: 9999 }} />
            </div>
            <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--b-text-onDark-muted)' }}>
              {SEATS_TAKEN} of {TOTAL_SEATS} seats reserved
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--b-text-onDark-muted)' }}>
              Batch starts {batchDateLabel}
            </p>
            <BuildersCountdown target={target} compact />
          </div>
        </AnimateOnScroll>

        <div className="max-w-xl mx-auto b-glass rounded-3xl p-7 sm:p-10 relative overflow-hidden">
          {status !== 'success' && (
            <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', background: 'var(--b-blue)' }}
              />
            </div>
          )}

          {status === 'success' ? (
            <SuccessScreen />
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>Claim your free seat</h2>
                <p className="b-muted mt-2 text-sm">Takes less than 2 minutes. Zero cost, zero catch.</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FloatingField id="bc-name" label="Full name" registration={register('name', { required: 'Please enter your name' })} error={errors.name?.message} />
                  <FloatingField
                    id="bc-email"
                    label="Email address"
                    type="email"
                    registration={register('email', {
                      required: 'Please enter your email',
                      pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
                    })}
                    error={errors.email?.message}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FloatingField id="bc-phone" label="WhatsApp number" type="tel" registration={register('phone', { required: 'Please enter your phone number' })} error={errors.phone?.message} />
                  <FloatingField id="bc-org" label="College / Company" registration={register('organisation', { required: 'Please enter your college or company' })} error={errors.organisation?.message} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FloatingSelect
                    id="bc-status"
                    label="You are a"
                    registration={register('status', { required: 'Please select an option' })}
                    error={errors.status?.message}
                    options={['Student', 'Working Professional', 'Career Switcher']}
                  />
                  <FloatingSelect
                    id="bc-skill"
                    label="Skill level"
                    registration={register('skillLevel', { required: 'Please select your skill level' })}
                    error={errors.skillLevel?.message}
                    options={[
                      'Complete Beginner',
                      'Knows Basics (HTML/CSS/JS or Python)',
                      'Comfortable with React or Node',
                      'Experienced Developer, new to AI',
                    ]}
                  />
                </div>

                <FloatingTextarea
                  id="bc-goal"
                  label="What do you want to build or land after this?"
                  registration={register('goal', { required: 'Please tell us your career goal' })}
                  error={errors.goal?.message}
                />

                {status === 'error' && (
                  <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)' }}>
                    <AlertTriangle size={17} style={{ color: '#F87171', flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: '#FCA5A5', fontWeight: 600, fontSize: '0.875rem' }}>
                      Submission failed. Please try again or WhatsApp us directly.
                    </p>
                  </div>
                )}

                <Magnetic strength={0.12} style={{ display: 'block', width: '100%' }}>
                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="b-btn-primary w-full"
                    style={{
                      padding: '1.0625rem 2rem',
                      fontSize: '1rem',
                      fontWeight: 700,
                      opacity: status === 'sending' ? 0.6 : 1,
                      cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {status === 'sending' ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Reserving your seat…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> Reserve My FREE Seat
                      </>
                    )}
                  </button>
                </Magnetic>

                <p className="text-center text-xs b-muted">No spam, no hidden charges. Just your bootcamp access details.</p>
              </form>
            </>
          )}
        </div>

        <div className="max-w-2xl mx-auto mt-20">
          <AnimateOnScroll className="text-center mb-6">
            <h3 style={{ fontSize: '1.375rem', fontWeight: 700 }}>Still deciding?</h3>
          </AnimateOnScroll>
          <FaqAccordion />
        </div>
      </div>
    </section>
  );
}
