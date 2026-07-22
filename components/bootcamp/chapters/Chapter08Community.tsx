'use client';

import Image from 'next/image';
import { Users, ShieldCheck } from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';
import { ChapterMark, TOTAL_SEATS, SEATS_TAKEN } from './primitives';

// Honest composite: role + city, not fabricated names. Represents the real
// mix of the batch (students / freshers / professionals, pan-India) without
// inventing specific people.
const roles = ['Engineering Student', 'Fresher', 'Working Professional'];
const cities = ['Pune', 'Mumbai', 'Bengaluru', 'Delhi', 'Hyderabad', 'Nashik', 'Indore', 'Nagpur', 'Chennai', 'Jaipur'];
const PALETTE = ['var(--b-blue)', 'var(--b-blue-soft)', 'var(--b-blue-dim)', '#334155'];
const members = Array.from({ length: 9 }, (_, i) => ({
  role: roles[i % roles.length],
  city: cities[i % cities.length],
  color: PALETTE[i % PALETTE.length],
  initials: `${roles[i % roles.length][0]}${cities[i % cities.length][0]}`,
}));

const moreCount = SEATS_TAKEN - members.length - 1;

export function ChapterCommunity() {
  return (
    <section className="b-chapter b-chapter-light" style={{ padding: '112px 0' }}>
      <div className="b-container">
        <AnimateOnScroll className="text-center mb-14">
          <ChapterMark index="08" label="Meet Your Future Batch" />
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, maxWidth: 680, margin: '0 auto' }}>
            You won&apos;t be building alone.
          </h2>
          <p className="mt-4" style={{ maxWidth: 540, margin: '1rem auto 0', fontSize: '1rem', lineHeight: 1.7, color: 'var(--b-text-onLight-muted)' }}>
            The moment you register, you&apos;re added to this group — the same one where your
            batch asks questions, shares progress, and pushes each other through Day 7.
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll delay={0.05} className="max-w-md mx-auto rounded-3xl overflow-hidden border border-[var(--b-line-light)]">
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: '#202C33' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--b-blue)' }}>
              <Users size={17} color="#fff" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">AI Builders — Batch #14</p>
              <p className="text-[11px] truncate" style={{ color: '#8696A0' }}>
                {SEATS_TAKEN} members · {TOTAL_SEATS - SEATS_TAKEN} spots left
              </p>
            </div>
          </div>

          <div style={{ background: '#0B141A' }}>
            <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0">
                <Image src="/learn.jpeg" alt="" fill sizes="32px" className="object-cover" />
              </div>
              <p className="text-[13px] flex-1 truncate" style={{ color: '#E9EDEF' }}>Pratik Sabale</p>
              <span className="flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5" style={{ background: 'rgba(94,217,160,0.12)' }}>
                <ShieldCheck size={11} style={{ color: '#5ED9A0' }} />
                <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#5ED9A0' }}>Mentor</span>
              </span>
            </div>

            {members.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-white"
                  style={{ background: m.color, fontSize: '0.5625rem' }}
                >
                  {m.initials}
                </div>
                <p className="text-[13px] flex-1 truncate" style={{ color: '#E9EDEF' }}>
                  {m.role} <span style={{ color: '#8696A0' }}>· {m.city}</span>
                </p>
              </div>
            ))}

            <div className="px-4 py-3 text-center">
              <span style={{ fontSize: '0.75rem', color: '#8696A0' }}>+ {moreCount} more members</span>
            </div>
          </div>
        </AnimateOnScroll>

        <StaggerContainer className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 max-w-2xl mx-auto mt-10">
          {roles.map((r) => (
            <StaggerItem key={r}>
              <span
                className="inline-flex items-center gap-2 text-sm font-medium"
                style={{ color: 'var(--b-text-onLight)' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: 'var(--b-blue)' }} />
                {r}s
              </span>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
