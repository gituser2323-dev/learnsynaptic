import { Plus, Award, GitBranch, Rocket, FileCheck } from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';
import { ChapterMark, GridBackdrop, GlowOrbs } from './primitives';

type PreviewKind = 'code' | 'dashboard' | 'chat';

const projects: { title: string; desc: string; kind: PreviewKind; repo: string }[] = [
  { title: 'AI Resume Analyzer', desc: 'Parses resumes with an LLM and scores them against a target job description in real time.', kind: 'dashboard', repo: 'resume-analyzer' },
  { title: 'AI Career Assistant', desc: 'A conversational agent that recommends roles and skill gaps based on your background.', kind: 'chat', repo: 'career-assistant' },
  { title: 'AI Interview Coach', desc: 'Simulates technical interviews and gives structured feedback on your answers.', kind: 'chat', repo: 'interview-coach' },
  { title: 'AI Chatbot', desc: 'A full-stack chatbot with memory, built on the OpenAI API and a React front end.', kind: 'code', repo: 'ai-chatbot' },
  { title: 'AI SaaS Dashboard', desc: 'A production-style dashboard with auth, billing UI, and live AI-generated insights.', kind: 'dashboard', repo: 'saas-dashboard' },
  { title: 'AI Code Reviewer', desc: 'An agent that reviews pull requests and leaves inline, context-aware comments.', kind: 'code', repo: 'code-reviewer' },
];

const proof = [
  { Icon: Rocket, title: 'A deployed capstone app', body: 'A live, shareable link — not a zip file on your laptop.' },
  { Icon: GitBranch, title: 'A public GitHub repo', body: 'Real commit history recruiters can actually open and read.' },
  { Icon: Award, title: 'Proof of your skills', body: 'A verifiable, LinkedIn-ready certificate — not the only thing you walk away with.' },
  { Icon: FileCheck, title: 'An interview-ready story', body: 'A project you can explain end-to-end under pressure.' },
];

const CODE_LINES = [
  { w: '38%', c: 'var(--b-blue-soft)' }, { w: '62%', c: 'rgba(255,255,255,0.35)' },
  { w: '48%', c: '#5ED9A0' }, { w: '70%', c: 'rgba(255,255,255,0.35)' },
  { w: '30%', c: '#F0B45E' }, { w: '55%', c: 'rgba(255,255,255,0.35)' },
];

function BrowserChrome({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--b-line-dark)' }}>
      <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#F87171' }} />
      <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#FBBF24' }} />
      <span style={{ width: 7, height: 7, borderRadius: 9999, background: '#34D399' }} />
      <span
        className="ml-2 rounded-md px-2.5 py-0.5 truncate"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--b-text-onDark-muted)', fontSize: '0.625rem', maxWidth: 180 }}
      >
        {url}
      </span>
    </div>
  );
}

function CodePreview() {
  return (
    <div className="h-28 px-4 py-3.5 flex flex-col gap-2.5" style={{ background: '#08080D' }}>
      {CODE_LINES.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <span style={{ fontSize: '0.5625rem', color: 'rgba(255,255,255,0.25)', width: 12 }}>{i + 1}</span>
          <span style={{ height: 5, width: l.w, borderRadius: 3, background: l.c, opacity: 0.75 }} />
        </div>
      ))}
    </div>
  );
}

function DashboardPreview() {
  const bars = [0.4, 0.7, 0.5, 0.9, 0.6, 0.35];
  return (
    <div className="h-28 px-4 py-3.5 flex items-end gap-2" style={{ background: '#08080D' }}>
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{
            height: `${h * 100}%`,
            background: i === 3 ? 'var(--b-blue)' : 'rgba(91,140,255,0.28)',
          }}
        />
      ))}
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="h-28 px-4 py-3.5 flex flex-col justify-end gap-2" style={{ background: '#08080D' }}>
      <div className="self-start rounded-xl rounded-tl-none px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.07)', maxWidth: '75%' }}>
        <span style={{ fontSize: '0.625rem', color: 'var(--b-text-onDark-muted)' }}>How do I improve this section?</span>
      </div>
      <div className="self-end rounded-xl rounded-tr-none px-3 py-1.5" style={{ background: 'rgba(22,93,252,0.35)', maxWidth: '80%' }}>
        <span style={{ fontSize: '0.625rem', color: '#fff' }}>Lead with the impact, then the tools you used.</span>
      </div>
    </div>
  );
}

const PREVIEWS: Record<PreviewKind, () => React.ReactElement> = {
  code: CodePreview,
  dashboard: DashboardPreview,
  chat: ChatPreview,
};

export function ChapterPortfolio() {
  return (
    <section id="portfolio" className="b-chapter b-chapter-dark" style={{ padding: '112px 0' }}>
      <GridBackdrop animate={false} />
      <GlowOrbs orbs={[{ bottom: '-10%', left: '-8%', size: 420, color: 'var(--b-blue)', opacity: 0.16 }]} />

      <div className="b-container relative">
        <AnimateOnScroll className="text-center mb-14">
          <ChapterMark index="07" label="What You'll Ship" />
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, maxWidth: 640, margin: '0 auto' }}>
            Instead of tutorials, <span style={{ color: 'var(--b-blue-soft)' }}>you&apos;ll ship.</span>
          </h2>
          <p className="b-muted mt-4" style={{ maxWidth: 520, margin: '1rem auto 0', fontSize: '1rem', lineHeight: 1.7 }}>
            Six real, working AI applications — the kind you put in a portfolio and talk about
            in an interview. Hover a card to see what&apos;s inside.
          </p>
        </AnimateOnScroll>
      </div>

      <div className="relative">
        <div className="b-rail flex gap-6 overflow-x-auto snap-x snap-mandatory px-6 pb-6" style={{ scrollPaddingLeft: 24 }}>
          <div className="shrink-0" style={{ width: 'calc((100vw - 1180px) / 2 - 24px)', minWidth: 0 }} aria-hidden="true" />
          {projects.map(({ title, desc, kind, repo }) => {
            const Preview = PREVIEWS[kind];
            return (
              <div
                key={title}
                className="group shrink-0 snap-start rounded-3xl b-glass overflow-hidden transition-transform duration-300 hover:-translate-y-1.5"
                style={{ width: 300 }}
                tabIndex={0}
              >
                <BrowserChrome url={`${repo}.vercel.app`} />
                <Preview />
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
                    <Plus
                      size={16}
                      className="shrink-0 transition-transform duration-300 group-hover:rotate-45"
                      style={{ color: 'var(--b-blue-soft)' }}
                    />
                  </div>
                  <div className="b-unfold">
                    <div>
                      <p className="pt-3" style={{ fontSize: '0.8125rem', lineHeight: 1.65, color: 'var(--b-text-onDark-muted)' }}>
                        {desc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="shrink-0" style={{ width: 'calc((100vw - 1180px) / 2 - 24px)', minWidth: 0 }} aria-hidden="true" />
        </div>
      </div>

      <div className="b-container relative mt-16">
        <AnimateOnScroll className="text-center mb-10">
          <p className="b-eyebrow" style={{ display: 'inline-flex' }}>Proof of your skills, not just a certificate</p>
        </AnimateOnScroll>
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
          {proof.map(({ Icon, title, body }) => (
            <StaggerItem key={title}>
              <div className="b-glass h-full rounded-2xl p-5" style={{ borderRadius: 18 }}>
                <Icon size={18} style={{ color: 'var(--b-blue-soft)' }} className="mb-3" />
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 6 }}>{title}</h3>
                <p className="b-muted" style={{ fontSize: '0.78125rem', lineHeight: 1.6 }}>{body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
