'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';

interface TeamMember {
  name: string;
  role: string;
  cred: string;
  photo: string | null;
  initials: string;
  editPlaceholder?: boolean;
}

const team: TeamMember[] = [
  {
    name: 'Pratik Sabale',
    role: 'Founder & Lead Instructor',
    cred: 'Delivered 5+ MERN+AI live cohorts; placed 200+ engineers in their first or next tech role',
    photo: '/gallery/20-founder-portrait.jpeg',
    initials: 'PS',
  },
  {
    name: '[EDIT: Name]',
    role: '[EDIT: Role]',
    cred: '[EDIT: Add one specific credential — not generic]',
    photo: null,
    initials: '??',
    editPlaceholder: true,
  },
  {
    name: '[EDIT: Name]',
    role: '[EDIT: Role]',
    cred: '[EDIT: Add one specific credential — not generic]',
    photo: null,
    initials: '??',
    editPlaceholder: true,
  },
];

function MemberCard({ member }: { member: TeamMember }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="bg-white rounded-2xl border flex flex-col overflow-hidden"
      style={{
        borderColor: hovered ? 'rgba(20,71,230,0.18)' : 'var(--ls-border)',
        boxShadow: hovered ? '0 8px 24px rgba(20,71,230,0.10)' : 'none',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Photo area */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '1/1', background: 'var(--ls-blue-tint)' }}
      >
        {member.photo ? (
          <Image
            src={member.photo}
            alt={`${member.name} — ${member.role}`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ background: 'var(--ls-blue-primary)' }}
            >
              {member.initials}
            </div>
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: 'white', color: 'var(--ls-muted)', border: '1px solid var(--ls-border)' }}
            >
              [EDIT: real photo]
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-6 flex flex-col flex-1">
        <p
          className="font-bold text-base mb-0.5"
          style={{ color: 'var(--ls-text)' }}
        >
          {member.name}
        </p>
        <p
          className="text-sm font-medium mb-3"
          style={{ color: 'var(--ls-blue-primary)' }}
        >
          {member.role}
        </p>
        <p
          className="text-sm leading-relaxed"
          style={{ color: member.editPlaceholder ? 'var(--ls-border)' : 'var(--ls-muted)' }}
        >
          {member.cred}
        </p>
      </div>
    </div>
  );
}

export function MeetTheTeam() {
  return (
    <section className="ls-section-alt">
      <div className="ls-container">
        <AnimateOnScroll className="text-center mb-12">
          <span className="ls-badge mb-4 inline-flex">The team</span>
          <h2 className="mb-3">Built by people who are still building</h2>
          <p style={{ maxWidth: 540, margin: '0 auto', color: 'var(--ls-muted)' }}>
            We&apos;re practitioners first, educators second — still writing code, still running
            live projects, still in the field alongside you.
          </p>
        </AnimateOnScroll>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {team.map((member,index) => (
            <StaggerItem key={`${member.name}-${index}`}>              <MemberCard member={member} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
