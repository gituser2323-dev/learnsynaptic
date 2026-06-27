import { Monitor, Server, Brain, Cloud } from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';

const categories = [
  {
    label: 'Frontend',
    Icon: Monitor,
    tools: ['React', 'TypeScript', 'Tailwind CSS'],
  },
  {
    label: 'Backend',
    Icon: Server,
    tools: ['Node.js', 'Express', 'MongoDB'],
  },
  {
    label: 'AI / ML',
    Icon: Brain,
    tools: ['OpenAI API', 'LangChain', 'Pinecone'],
  },
  {
    label: 'DevOps / Cloud',
    Icon: Cloud,
    tools: ['Docker', 'AWS', 'GitHub Actions'],
  },
];

export function TechStackSection() {
  return (
    <section className="ls-section-alt">
      <div className="ls-container">
        <AnimateOnScroll className="text-center mb-10">
          <span className="ls-badge mb-4 inline-flex">Curriculum</span>
          <h2 className="mb-3">The tools you&apos;ll actually use on the job</h2>
          <p style={{ maxWidth: 520, margin: '0 auto', color: 'var(--ls-muted)' }}>
            Every program is built around the exact stack companies hire for — not outdated
            textbook exercises. You learn tools that are live in production right now.
          </p>
        </AnimateOnScroll>

        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {categories.map(({ label, Icon, tools }) => (
            <StaggerItem key={label}>
              <div
                className="bg-white rounded-2xl border p-5 h-full"
                style={{ borderColor: 'var(--ls-border)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--ls-blue-tint)' }}
                  >
                    <Icon size={18} style={{ color: 'var(--ls-blue-primary)' }} />
                  </div>
                  <span className="font-bold text-sm" style={{ color: 'var(--ls-text)' }}>
                    {label}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {tools.map((tool) => (
                    <div
                      key={tool}
                      className="flex items-center gap-2.5 text-sm py-2 px-3 rounded-lg font-medium"
                      style={{ background: 'var(--ls-bg-alt)', color: 'var(--ls-text)' }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: 'var(--ls-blue-primary)' }}
                      />
                      {tool}
                    </div>
                  ))}
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
