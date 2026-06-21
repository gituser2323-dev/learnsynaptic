import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { blogPosts } from '@/lib/blog-posts';

export const metadata: Metadata = {
  title: 'Blog — AI, Full Stack & Career Advice',
  description:
    'Practical guides on AI engineering, full-stack development, career transitions, and the tech job market in India.',
  keywords: [
    'AI engineering blog India',
    'full stack developer career',
    'GenAI tutorial',
    'tech career advice Pune',
    'learn AI India',
  ],
};

const categoryStyles: Record<string, string> = {
  'Career Advice':    'bg-blue-50 text-blue-700',
  'AI Engineering':   'bg-purple-50 text-purple-700',
  'Industry Insights':'bg-green-50 text-green-700',
  'Learning Guide':   'bg-amber-50 text-amber-700',
  'Freelancing':      'bg-blue-50 text-blue-700',
};

function CategoryBadge({ category }: { category: string }) {
  const styles = categoryStyles[category] ?? 'bg-gray-100 text-gray-600';
  return (
    <span
      className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${styles}`}
    >
      {category}
    </span>
  );
}

export default function BlogIndexPage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="ls-section" style={{ background: 'var(--ls-hero-bg)' }}>
        <div className="ls-container">
          <div className="max-w-2xl">
            <span className="ls-badge mb-4">LearnSynaptic Blog</span>
            <h1 className="mt-3 mb-4">
              Practical guides for builders who are serious about AI
            </h1>
            <p className="text-lg" style={{ color: 'var(--ls-muted)' }}>
              No hype, no 30-day challenge content. Just useful writing on AI
              engineering, full-stack development, the Indian tech job market,
              and what it actually takes to get hired.
            </p>
          </div>
        </div>
      </section>

      {/* ── Post grid ──────────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col rounded-xl border p-6 transition-shadow hover:shadow-lg"
                style={{ borderColor: 'var(--ls-border)', background: '#fff' }}
              >
                {/* Top row: category + read time */}
                <div className="flex items-center justify-between mb-3">
                  <CategoryBadge category={post.category} />
                  <span
                    className="flex items-center gap-1 text-xs font-medium"
                    style={{ color: 'var(--ls-muted)' }}
                  >
                    <Clock size={12} />
                    {post.readTime}
                  </span>
                </div>

                {/* Title */}
                <h3
                  className="text-lg font-bold leading-snug mb-3 group-hover:text-[var(--ls-blue-primary)] transition-colors"
                  style={{ color: 'var(--ls-text)' }}
                >
                  {post.title}
                </h3>

                {/* Excerpt */}
                <p
                  className="text-sm leading-relaxed flex-1 mb-4"
                  style={{ color: 'var(--ls-muted)' }}
                >
                  {post.excerpt}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-4 border-t" style={{ borderColor: 'var(--ls-border)' }}>
                  <span className="text-xs" style={{ color: 'var(--ls-muted)' }}>
                    {post.publishDate}
                  </span>
                  <span
                    className="flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all"
                    style={{ color: 'var(--ls-blue-primary)' }}
                  >
                    Read article <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
