'use client';

import { Mail, MessageCircle, Bell, GitBranch, PartyPopper, Briefcase } from 'lucide-react';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';
import { ChapterMark } from './primitives';

const notifications = [
  { Icon: Mail, app: 'LearnSynaptic', color: '#64748B', title: "You're in!", body: 'Confirmation + WhatsApp link sent to your email.', time: 'now' },
  { Icon: MessageCircle, app: 'AI Builders — Batch #14', color: '#22C55E', title: 'Added to the group', body: 'Meet your cohort before Day 1 👋', time: '2m ago' },
  { Icon: Bell, app: 'LearnSynaptic Live', color: 'var(--b-blue)', title: 'Starting soon', body: 'Day 1 goes live in 1 hour ⏰', time: 'Day 1' },
  { Icon: GitBranch, app: 'GitHub', color: '#18181B', title: 'Repository created', body: 'ai-chatbot — your first commit is in.', time: 'Day 4' },
  { Icon: PartyPopper, app: 'LearnSynaptic', color: '#F59E0B', title: 'Demo Day', body: 'Show the batch what you built 🎉', time: 'Day 7' },
  { Icon: Briefcase, app: 'LearnSynaptic Careers', color: '#16A34A', title: 'Interview slot confirmed', body: 'Mock interview + resume review booked.', time: 'Week 2' },
];

export function ChapterAfterRegister() {
  return (
    <section className="b-chapter b-chapter-light" style={{ padding: '112px 0' }}>
      <div className="b-container">
        <AnimateOnScroll className="text-center mb-16">
          <ChapterMark index="10" label="What Happens After You Register" />
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, maxWidth: 680, margin: '0 auto' }}>
            No guesswork. Here&apos;s what actually lands in your phone.
          </h2>
        </AnimateOnScroll>

        <div className="max-w-md mx-auto flex flex-col gap-3">
          {notifications.map((n, i) => (
            <AnimateOnScroll key={n.title} delay={i * 0.06}>
              <div
                className="flex items-start gap-3 rounded-2xl px-4 py-3.5 bg-white"
                style={{ border: '1px solid var(--b-line-light)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: n.color }}
                >
                  <n.Icon size={16} color="#fff" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--b-text-onLight-muted)' }}>
                      {n.app}
                    </p>
                    <span className="shrink-0 text-[11px]" style={{ color: 'var(--b-text-onLight-muted)' }}>
                      {n.time}
                    </span>
                  </div>
                  <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--b-text-onLight)' }}>
                    {n.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--b-text-onLight-muted)', lineHeight: 1.5 }}>
                    {n.body}
                  </p>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
