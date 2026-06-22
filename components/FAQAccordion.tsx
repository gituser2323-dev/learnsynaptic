'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion, type Transition } from 'framer-motion';

const ease = [0.0, 0.0, 0.2, 1.0] as [number, number, number, number];

const faqGroups = [
  {
    id: 'programs',
    label: 'Programs',
    items: [
      {
        q: 'How long are the programs, and can I join while working full-time?',
        a: 'Programs range from 8 weeks (AI Beginner Bootcamp) to 6 months (AI Powered Full Stack Dev + DevOps). All batches are structured as weekend cohorts — live sessions run Saturday and/or Sunday so you never have to choose between upskilling and your current job. Every session is recorded and available within 24 hours, so missing one occasionally won\'t derail your progress.',
      },
      {
        q: 'Do I need prior coding experience to join?',
        a: 'It depends on the program. The AI Beginner Bootcamp is built for complete beginners — zero coding background required. The Full Stack Dev + DevOps program expects basic familiarity with at least one programming language. Data Science and GenAI Builder both need some Python basics. If you\'re not sure where you stand, book a free counselling call and we\'ll give you an honest read.',
      },
      {
        q: 'Are sessions live or recorded? What if I miss one?',
        a: 'All sessions are live — that\'s intentional. Real learning happens in interactive classes with live Q&A and real-time project feedback, not passive video playback. Every live session is recorded and made available within 24 hours. We strongly encourage attending live, especially for the project review and debugging portions, but we don\'t penalise students for occasional absences.',
      },
      {
        q: 'How large are the batches? Will I get individual feedback on my work?',
        a: 'Batches are deliberately kept small — 15 to 25 students per cohort. Pratik personally reviews project submissions and is active in the dedicated group for each batch throughout the program. Project review is scheduled into every program, not treated as an add-on. The batch size limit is how we protect that quality as we grow.',
      },
      {
        q: 'What happens if the batch I want to join is full?',
        a: "If a batch is full before you complete enrollment, we will add you to the waitlist for that cohort and guarantee your spot in the next one at the same price. Waitlist position is based on when your registration fee is received. We will always confirm batch availability before you pay — we do not take payment for a full batch without telling you first.",
      },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    items: [
      {
        q: 'What do the programs cost? Are there hidden fees after enrolment?',
        a: 'Pricing varies by program — book a free consultation for exact details. There are no hidden charges: the fee covers all live sessions, session recordings, project reviews, and 6 months of placement support. You will not be upsold premium mentorship tiers or certificate upgrades after joining.',
      },
      {
        q: 'Do you offer EMI or instalment payment options?',
        a: 'Yes. All programs offer 0% interest EMI via Razorpay — 9 equal monthly instalments with no processing fee. A registration fee is required upfront to reserve your seat and is adjusted against the total. If you need a custom arrangement, reach out directly — cost should not be the only thing stopping a serious candidate from starting.',
      },
      {
        q: 'What is the refund policy if I need to leave the program?',
        a: 'If you withdraw within the first 7 days of a batch starting, you receive a full refund minus payment processing fees. After 7 days, refunds are pro-rated based on how much of the program has been delivered. No request is declined without a direct conversation — reach out and we will work through it fairly.',
      },
    ],
  },
  {
    id: 'placement',
    label: 'Placement',
    items: [
      {
        q: 'What does placement support actually include — specifically?',
        a: 'Placement support is a structured process, not just a resume template. It includes: a resume and LinkedIn profile review targeted to the roles you are applying for; mock technical interviews conducted by Pratik or a senior from our network; direct introductions to our 60+ hiring partner companies; and active follow-up on live openings for up to 6 months after you complete the program. We track each graduate\'s progress individually.',
      },
      {
        q: "What's your placement rate? Is placement guaranteed?",
        a: 'Our placement support rate is 90% across all programs tracked over the last 12 months. We do not guarantee placement — the honest position is that outcomes depend on the quality of what you build during the program, how actively you engage in placement support, and market conditions at the time you graduate. We guarantee the process and the introductions; the result is the combination of that and your work.',
      },
      {
        q: 'How long after completing do you actively support job searches?',
        a: 'Active placement support — resume reviews, mock interviews, and hiring partner introductions — runs for 6 months post-completion. After that window, you remain part of the LearnSynaptic alumni network permanently: you will hear about new openings, can request reference letters, and are welcome back to any Q&A session at no cost.',
      },
    ],
  },
];

interface NavLinkProps {
  id: string;
  label: string;
}
function NavLink({ id, label }: NavLinkProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={`#${id}`}
      className="block text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      style={{
        color: hovered ? 'var(--ls-blue-primary)' : 'var(--ls-muted)',
        background: hovered ? 'var(--ls-blue-tint)' : 'transparent',
        transition: 'color 150ms ease, background 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </a>
  );
}

export function FAQAccordion() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const toggle = (key: string) => setOpenKey((prev) => (prev === key ? null : key));

  return (
    <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">
      {/* Sticky category nav */}
      <nav
        aria-label="FAQ categories"
        className="w-full lg:w-40 shrink-0 lg:sticky lg:top-28"
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--ls-muted)' }}
        >
          Jump to
        </p>
        <ul className="flex flex-row lg:flex-col gap-1 flex-wrap">
          {faqGroups.map(({ id, label }) => (
            <li key={id}>
              <NavLink id={id} label={label} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Accordion groups */}
      <div className="flex-1 min-w-0 space-y-12">
        {faqGroups.map((group) => (
          <div key={group.id} id={group.id} className="scroll-mt-28">
            <h2
              className="pb-4 mb-1"
              style={{
                borderBottom: '2px solid var(--ls-border)',
                fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)',
                letterSpacing: '-0.01em',
              }}
            >
              {group.label}
            </h2>

            {group.items.map((item, i) => {
              const key = `${group.id}-${i}`;
              const isOpen = openKey === key;
              return (
                <div key={key} style={{ borderBottom: '1px solid var(--ls-border)' }}>
                  <button
                    className="w-full flex items-center justify-between gap-4 py-5 text-left"
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                  >
                    <span
                      className="font-semibold text-[0.9375rem] leading-snug"
                      style={{ color: 'var(--ls-text)' }}
                    >
                      {item.q}
                    </span>
                    <ChevronDown
                      size={17}
                      aria-hidden
                      style={{
                        color: 'var(--ls-muted)',
                        flexShrink: 0,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms ease',
                      }}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease } satisfies Transition}
                        style={{ overflow: 'hidden' }}
                      >
                        <p
                          className="pb-5 text-[0.9375rem] leading-relaxed"
                          style={{ color: 'var(--ls-muted)', maxWidth: 660 }}
                        >
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
