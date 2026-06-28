import Link from 'next/link';
import { ArrowRight, Check, X, Minus } from 'lucide-react';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';

interface ComparisonRow {
  label: string;
  learnSynaptic: { text: string; positive: boolean };
  others: { text: string; positive: boolean };
}

// Each "Other Institutes" point describes a common industry pattern,
// not a claim about any specific named competitor — keeps every row
// honest and defensible without naming or implying anything about a
// particular institute.
const rows: ComparisonRow[] = [
  {
    label: "Learning Approach",
    learnSynaptic: {
      text: "Project-based learning with real-world problem solving",
      positive: true,
    },
    others: {
      text: "Theory-heavy classroom learning",
      positive: false,
    },
  },
  {
    label: "Curriculum",
    learnSynaptic: {
      text: "Updated regularly with AI, cloud and modern industry tools",
      positive: true,
    },
    others: {
      text: "Updates less frequently",
      positive: false,
    },
  },
  {
    label: "Hands-on Experience",
    learnSynaptic: {
      text: "20+ portfolio projects and internship experience",
      positive: true,
    },
    others: {
      text: "Mostly practice assignments",
      positive: false,
    },
  },
  {
    label: "Mentorship",
    learnSynaptic: {
      text: "Small batches with direct mentor support",
      positive: true,
    },
    others: {
      text: "Limited individual guidance in larger batches",
      positive: false,
    },
  },
  {
    label: "Career Preparation",
    learnSynaptic: {
      text: "Resume reviews, mock interviews and placement guidance",
      positive: true,
    },
    others: {
      text: "Basic career support",
      positive: false,
    },
  },
  {
    label: "Technology Stack",
    learnSynaptic: {
      text: "AI, Full Stack, Data Science, Analytics & Cloud",
      positive: true,
    },
    others: {
      text: "Often focused on a single technology",
      positive: false,
    },
  },
  {
    label: "Learning Support",
    learnSynaptic: {
      text: "Recordings, doubt sessions and lifetime community access",
      positive: true,
    },
    others: {
      text: "Limited support after classes",
      positive: false,
    },
  },
  {
    label: "Career Focus",
    learnSynaptic: {
      text: "Built to make students industry-ready from day one",
      positive: true,
    },
    others: {
      text: "Often focused primarily on course completion",
      positive: false,
    },
  },
];

export function CompetitiveComparisonTable() {
  return (
    <section className="ls-section">
      <div className="ls-container">
        <AnimateOnScroll className="mb-10">
          <span className="ls-badge mb-4 inline-flex">Why LearnSynaptic</span>
          <h2
            className="
  mt-6
  text-4xl
  font-black
  tracking-[-0.04em]
  leading-tight

  sm:text-5xl

  lg:text-6xl
"
          >
            Why Thousands Choose

            <span className="block bg-gradient-to-r from-[#165DFC] via-blue-500 to-cyan-400 bg-clip-text text-transparent">

              Learn Synaptic

            </span>

          </h2>          <p style={{ maxWidth: 560, color: 'var(--ls-muted)' }}>
            Not every training program is built the same way. Here&rsquo;s what
            actually differs — stated plainly, no vague claims.
          </p>
        </AnimateOnScroll>

        {/* Desktop table — visible lg+ */}
        <AnimateOnScroll>
          <div
            className="
hidden
lg:block

overflow-hidden

rounded-[32px]

border

border-slate-200

bg-white

shadow-[0_30px_80px_rgba(15,23,42,.08)]
"            style={{ borderColor: 'var(--ls-border)' }}
          >
            {/* Header row */}
            <div
className="grid grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)] gap-4 px-6 py-5"              style={{
                background:
                  'linear-gradient(180deg,#165DFC 0%,#2563EB 100%)',
                borderBottom: '1px solid var(--ls-border)',
              }}
            >
              <span />
              <div
                className="
flex
items-center
gap-3
rounded-2xl
bg-gradient-to-r
from-[#165DFC]
to-blue-500
px-5
py-3
text-white
"
                style={{ background: "white" }}
              >

                <div
                  className="
flex
h-10
w-10
items-center
justify-center
rounded-xl
bg-gradient-to-r
from-[#165DFC]
to-blue-500
font-black
"
                >

                  LS

                </div>

                <div>

                  <p className="font-bold">

                    Learn Synaptic

                  </p>

                  <p className="text-xs opacity-80">

                    Industry Ready Learning

                  </p>

                </div>

              </div>


              <div
                className="
flex
items-center
gap-3

rounded-2xl
bg-gradient-to-r
from-[#165DFC]
to-blue-500
px-5
py-3
text-white
"
                style={{ background: "white" }}
              >

                <div
                  className="
flex
h-10
w-10
items-center
justify-center
rounded-xl
bg-gradient-to-r
from-[#165DFC]
to-blue-500
font-black
"
                >

                  OI

                </div>

                <div>

                  <p className="font-bold">

                    Other Institute

                  </p>

                  <p className="text-xs opacity-80">

                    Traditional Learning

                  </p>

                </div>

              </div>
            </div>

            {/* Comparison rows */}
            {rows.map((row, i) => (
              <div
                key={row.label}
className="grid grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)] gap-4 px-6 py-5"     style={{
                  background: i % 2 === 0 ? '#fff' : 'var(--ls-bg-alt)',
                  borderTop: i > 0 ? '1px solid var(--ls-border)' : undefined,
                }}
              >
                <p className="text-sm font-semibold pr-4" style={{ color: 'var(--ls-text)' }}>
                  {row.label}
                </p>

                <div className="flex items-start gap-2.5 pr-6">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'var(--ls-blue-tint)' }}
                  >
                    <Check size={12} style={{ color: 'var(--ls-blue-primary)' }} />
                  </span>
                  <p className="text-sm leading-snug" style={{ color: 'var(--ls-text)' }}>
                    {row.learnSynaptic.text}
                  </p>
                </div>

<div className="flex min-w-0 items-start gap-3 pr-6">                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <Minus size={12} className="text-slate-400" />
                  </span>
<p className="min-w-0 break-words text-sm leading-6">                    {row.others.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </AnimateOnScroll>

        {/* Mobile cards — visible < lg, each row becomes its own card
            so the two-column comparison stays readable on a phone */}
        <div className="lg:hidden space-y-4">
          {rows.map((row) => (
            <div
              key={row.label}
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: 'var(--ls-border)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--ls-muted)' }}>
                {row.label}
              </p>

              <div
                className="
flex
items-start
gap-4

rounded-2xl

bg-gradient-to-r

from-blue-50

to-blue-100/40

p-4

transition

duration-300

group-hover:scale-[1.02]
"
              >                <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--ls-blue-tint)' }}
              >
                  <div
                    className="
flex

h-8

w-8

items-center

justify-center

rounded-full

bg-[#165DFC]

text-white

shadow-lg

shadow-blue-500/20
"
                  >

                    <Check size={16} />

                  </div>                </span>
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--ls-blue-primary)' }}>
                    LearnSynaptic
                  </p>
                  <p className="text-sm leading-snug" style={{ color: 'var(--ls-text)' }}>
                    {row.learnSynaptic.text}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <Minus size={12} className="text-slate-400" />
                </span>
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--ls-muted)' }}>
                    Other Institutes (typical)
                  </p>
                  <p className="text-sm leading-snug" style={{ color: 'var(--ls-muted)' }}>
                    {row.others.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <AnimateOnScroll className="text-center mt-8">
          <Link href="/programs" className="ls-btn-primary">
            See Our Programs <ArrowRight size={15} />
          </Link>
        </AnimateOnScroll>
      </div>
    </section>
  );
}