import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CheckCircle2,
  BookOpen,
  Briefcase,
  Users,
  Rocket,
  ArrowRight,
  FileCheck,
  GitBranch,
  Award,
} from 'lucide-react'
import { InternshipApplyForm } from '@/components/InternshipApplyForm'

export const metadata: Metadata = {
  title: 'Internship Track — Real Projects for Enrolled Students',
  description:
    'Included with select LearnSynaptic programs — work on a real project brief with mentorship and walk away with a deployed, demoable build and experience letter.',
  keywords: [
    'LearnSynaptic internship',
    'student internship India',
    'AI internship program',
    'full stack internship Pune',
  ],
}

const steps = [
  {
    number: '01',
    icon: BookOpen,
    title: 'Complete your core program modules',
    description:
      'The Internship Track opens after you have covered the core curriculum. You need the foundations in place before the project work will make sense — this is not a shortcut, it is a capstone.',
  },
  {
    number: '02',
    icon: Briefcase,
    title: 'Get matched to a real project brief',
    description:
      'Based on your program track and what you want to build, you are matched to a specific project brief. Briefs are tied to real use cases — not invented exercises — so the deliverable has genuine utility.',
  },
  {
    number: '03',
    icon: Users,
    title: 'Build under live mentorship',
    description:
      'Weekly check-ins with Pratik, async code reviews, and structured milestones. You make the technical decisions — the mentorship keeps you unblocked and honest about quality.',
  },
  {
    number: '04',
    icon: Rocket,
    title: 'Ship it, demo it, own it',
    description:
      'You deploy the project to a live URL, write the documentation, and present the demo. The finished build goes on your GitHub and portfolio as something you actually shipped.',
  },
]

// [EDIT: Pratik — confirm exact eligibility per program before publishing]
const eligibilityItems = [
  {
    program: 'AI Powered Full Stack Dev + DevOps',
    eligible: true,
    note: 'Included — project briefs are full-stack with CI/CD deployment',
  },
  {
    program: 'GenAI Builder → Freelancer Program',
    eligible: true,
    note: 'Included — project briefs focus on RAG systems and AI-integrated tools',
  },
  {
    // [EDIT: confirm if Data Science track includes internship or a variation of it]
    program: 'Data Science — AI/ML Specialisation',
    eligible: null,
    note: '[EDIT: Confirm — may include a data project track rather than the standard internship brief]',
  },
  {
    program: 'AI Beginner Bootcamp',
    eligible: false,
    note: 'Not included — the Bootcamp is 8 weeks and does not have enough runway for a project engagement',
  },
]

// Illustrative examples only — exact briefs are matched per cohort and track
const exampleProjects = [
  {
    track: 'GenAI Builder',
    title: 'RAG-powered document assistant for a local business',
    description:
      'Build a system that lets a small business query their own product documentation, FAQs, or policy documents using natural language. Deployed as a web interface, integrated with a vector database.',
    tags: ['LangChain', 'Pinecone', 'Next.js', 'OpenAI API'],
  },
  {
    track: 'Full Stack + DevOps',
    title: 'Full-stack app with CI/CD pipeline and live deployment',
    description:
      'Build a real-use-case web application (defined in the brief) and deploy it to AWS EC2 with Dockerised containers, Nginx reverse proxy, and a GitHub Actions pipeline that ships on every push to main.',
    tags: ['Node.js', 'React', 'Docker', 'AWS EC2', 'GitHub Actions'],
  },
  {
    track: 'GenAI Builder',
    title: 'AI-integrated query classifier for an e-commerce context',
    description:
      'Build a classifier that categorises incoming customer queries (returns, shipping, product info) and routes them to the right response template. Includes a simple admin dashboard for reviewing outputs.',
    tags: ['OpenAI API', 'Python', 'FastAPI', 'React'],
  },
  {
    track: 'Full Stack + DevOps',
    title: 'Containerised REST API with monitoring and logging',
    description:
      'Build and deploy a production-grade Node.js API for a defined use case, with structured logging, error tracking, health check endpoints, and a load-balanced setup on a cloud instance.',
    tags: ['Node.js', 'Docker', 'Nginx', 'PM2', 'AWS'],
  },
]

const outcomes = [
  {
    icon: Rocket,
    title: 'Deployed project with a live URL',
    body: 'Not a screenshot or a localhost recording — a real URL you can send to a recruiter or client.',
  },
  {
    icon: GitBranch,
    title: 'Documented GitHub repository',
    body: 'Professional README, clean commit history, and architecture notes — the kind of repo that actually impresses.',
  },
  {
    icon: FileCheck,
    title: 'Experience letter on LearnSynaptic letterhead',
    body: 'Formally acknowledges the internship engagement, the project delivered, and the duration of work.',
  },
  {
    icon: Award,
    title: 'LinkedIn recommendation from Pratik',
    body: 'Specific to what you built and what decisions you made — not a generic "great student" endorsement.',
  },
]

export default function InternshipPage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        style={{
          background: 'var(--ls-hero-bg)',
          paddingTop: 120,
          paddingBottom: 100,
        }}
      >
        <div className="ls-container">
          <div style={{ maxWidth: 760 }}>
            <span className="ls-badge mb-5 inline-block">Included with Enrollment</span>
            <h1 style={{ marginBottom: 20 }}>
              Real-World Experience,
              <br />
              Built Into Your Program
            </h1>
            <p
              style={{
                fontSize: 'clamp(1.05rem, 2.5vw, 1.2rem)',
                color: 'var(--ls-muted)',
                lineHeight: 1.7,
                maxWidth: 600,
                marginBottom: 36,
              }}
            >
              The Internship Track is not a 5th program to purchase. It is an add-on
              for students already enrolled in select programs — real project work with
              actual deliverables, mentorship on every milestone, and something demoable
              at the end.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#apply" className="ls-btn-primary">
                Apply for the Internship Track <ArrowRight size={16} />
              </a>
              <a href="#eligibility" className="ls-btn-outline">
                See eligible programs
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="ls-section" style={{ background: '#fff' }}>
        <div className="ls-container">
          <div style={{ maxWidth: 640, marginBottom: 56 }}>
            <h2 style={{ marginBottom: 12 }}>How it works</h2>
            <p style={{ color: 'var(--ls-muted)', fontSize: '1.0625rem', lineHeight: 1.7 }}>
              Four stages, in sequence. The project work only begins after you have the
              fundamentals to execute it — so everything you learn in the core modules
              has a direct application in the internship phase.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <div
                  key={step.number}
                  className="flex gap-5 p-7 rounded-xl border"
                  style={{ borderColor: 'var(--ls-border)', background: '#fff' }}
                >
                  <div style={{ flexShrink: 0 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'var(--ls-blue-tint)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={22} color="var(--ls-blue-primary)" strokeWidth={2} />
                    </div>
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        color: 'var(--ls-blue-primary)',
                        marginBottom: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      Step {step.number}
                    </p>
                    <h3
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: 'var(--ls-text)',
                        marginBottom: 8,
                        lineHeight: 1.3,
                      }}
                    >
                      {step.title}
                    </h3>
                    <p style={{ color: 'var(--ls-muted)', fontSize: '0.9375rem', lineHeight: 1.7 }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── What You Walk Away With ───────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <div style={{ maxWidth: 640, marginBottom: 48 }}>
            <h2 style={{ marginBottom: 12 }}>What you walk away with</h2>
            <p style={{ color: 'var(--ls-muted)', fontSize: '1.0625rem', lineHeight: 1.7 }}>
              Four concrete outputs — not certificates for completing modules, but
              evidence that you built something real.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {outcomes.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="p-6 rounded-xl" style={{ background: '#fff', border: '1px solid var(--ls-border)' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: 'var(--ls-blue-tint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Icon size={20} color="var(--ls-blue-primary)" strokeWidth={2} />
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ls-text)', marginBottom: 8, lineHeight: 1.3 }}>
                    {item.title}
                  </h3>
                  <p style={{ color: 'var(--ls-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    {item.body}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Eligibility ──────────────────────────────────────────────────── */}
      <section id="eligibility" className="ls-section" style={{ background: '#fff' }}>
        <div className="ls-container">
          <div style={{ maxWidth: 640, marginBottom: 48 }}>
            <h2 style={{ marginBottom: 12 }}>Who is eligible</h2>
            <p style={{ color: 'var(--ls-muted)', fontSize: '1.0625rem', lineHeight: 1.7 }}>
              The Internship Track is a structured engagement, not a casual add-on.
              It requires a program of sufficient depth to have a foundation to build
              from — which is why not every program includes it.
            </p>
          </div>

          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--ls-border)', maxWidth: 760 }}
          >
            {eligibilityItems.map((item, i) => (
              <div
                key={item.program}
                className="flex items-start gap-4 p-5"
                style={{
                  borderBottom: i < eligibilityItems.length - 1 ? '1px solid var(--ls-border)' : 'none',
                  background: '#fff',
                }}
              >
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {item.eligible === true && (
                    <CheckCircle2 size={20} color="var(--ls-success)" strokeWidth={2} />
                  )}
                  {item.eligible === false && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--ls-muted)', fontWeight: 700 }}>–</span>
                    </div>
                  )}
                  {item.eligible === null && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fef3c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>?</span>
                    </div>
                  )}
                </div>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--ls-text)', marginBottom: 2, fontSize: '0.9375rem' }}>
                    {item.program}
                  </p>
                  <p style={{ color: 'var(--ls-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    {item.note}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 16, fontSize: '0.8rem', color: 'var(--ls-muted)' }}>
            Eligibility confirmed at time of enrollment. If you are unsure whether your program
            includes the track, ask during your counselling call.
          </p>
        </div>
      </section>

      {/* ── Example Project Briefs ───────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <div style={{ maxWidth: 760, marginBottom: 12 }}>
            <h2 style={{ marginBottom: 12 }}>Example project briefs</h2>
            <p style={{ color: 'var(--ls-muted)', fontSize: '1.0625rem', lineHeight: 1.7, marginBottom: 4 }}>
              Exact briefs are matched per student and cohort — what you build depends on your
              track, your goals, and what makes sense to ship in the available time.
            </p>
            <p
              style={{
                display: 'inline-block',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#92400e',
                background: '#fef3c7',
                padding: '4px 10px',
                borderRadius: 6,
                marginBottom: 40,
              }}
            >
              Illustrative examples only — not a guarantee of specific project types
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {exampleProjects.map((project) => (
              <div
                key={project.title}
                className="p-6 rounded-xl border"
                style={{ borderColor: 'var(--ls-border)', background: '#fff' }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'var(--ls-blue-tint)',
                    color: 'var(--ls-blue-primary)',
                    padding: '3px 10px',
                    borderRadius: 99,
                    marginBottom: 12,
                  }}
                >
                  {project.track}
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ls-text)', marginBottom: 10, lineHeight: 1.35 }}>
                  {project.title}
                </h3>
                <p style={{ color: 'var(--ls-muted)', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: 16 }}>
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: 'var(--ls-muted)',
                        background: 'var(--ls-bg-alt)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid var(--ls-border)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Apply ────────────────────────────────────────────────────────── */}
      <section id="apply" className="ls-section" style={{ background: '#fff' }}>
        <div className="ls-container">
          <div className="grid gap-16 lg:grid-cols-2 items-start">
            {/* Left: context */}
            <div>
              <span className="ls-badge mb-4 inline-block">Apply for the Internship Track</span>
              <h2 style={{ marginBottom: 16 }}>
                Tell us what you want to build
              </h2>
              <p style={{ color: 'var(--ls-muted)', fontSize: '1.0625rem', lineHeight: 1.7, marginBottom: 24 }}>
                Applications are reviewed by Pratik personally. There is no automated filter —
                what you write in the "what you want to build" field determines the project brief
                you get matched to. Be specific about the problem you want to solve.
              </p>

              <div className="space-y-4">
                {[
                  'Applications reviewed within 2 business days',
                  'No additional cost — included with your program enrollment',
                  'Project matched to your track and stated goals',
                  'Eligibility confirmed before project start',
                ].map((point) => (
                  <div key={point} className="flex items-start gap-3">
                    <CheckCircle2
                      size={18}
                      color="var(--ls-success)"
                      strokeWidth={2}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <p style={{ color: 'var(--ls-muted)', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
                      {point}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className="mt-8 p-5 rounded-xl"
                style={{ background: 'var(--ls-blue-tint)', border: '1.5px solid rgba(20,71,230,0.15)' }}
              >
                <p style={{ fontWeight: 700, color: 'var(--ls-text)', marginBottom: 4, fontSize: '0.9375rem' }}>
                  Not enrolled yet?
                </p>
                <p style={{ color: 'var(--ls-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 12 }}>
                  Enroll in an eligible program first, then apply for the Internship Track once
                  you start your core modules.
                </p>
                <Link
                  href="/programs"
                  className="text-sm font-semibold"
                  style={{ color: 'var(--ls-blue-primary)' }}
                >
                  See all programs →
                </Link>
              </div>
            </div>

            {/* Right: form */}
            <div
              className="p-8 rounded-2xl border"
              style={{ borderColor: 'var(--ls-border)', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
            >
              <InternshipApplyForm />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
