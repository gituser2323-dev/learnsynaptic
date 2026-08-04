import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { blogPosts, getPostBySlug, type ContentBlock } from '@/lib/blog-posts';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    alternates: { canonical: `/blog/${slug}` },
    title: post.title,
    description: post.metaDescription,
  };
}

function renderBlock(block: ContentBlock, index: number) {
  switch (block.type) {
    case 'h2':
      return (
        <h2
          key={index}
          className="mt-10 mb-4"
          style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ls-text)' }}
        >
          {block.text}
        </h2>
      );
    case 'h3':
      return (
        <h3
          key={index}
          className="mt-8 mb-3"
          style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ls-text)' }}
        >
          {block.text}
        </h3>
      );
    case 'p':
      return (
        <p
          key={index}
          className="mb-5 leading-relaxed"
          style={{ color: 'var(--ls-muted)', fontSize: '1.0625rem' }}
        >
          {block.text}
        </p>
      );
    case 'ul':
      return (
        <ul key={index} className="mb-5 pl-6 space-y-2" style={{ listStyleType: 'disc' }}>
          {block.items?.map((item, i) => (
            <li key={i} style={{ color: 'var(--ls-muted)', fontSize: '1.0625rem', lineHeight: 1.7 }}>
              {item}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={index} className="mb-5 pl-6 space-y-2" style={{ listStyleType: 'decimal' }}>
          {block.items?.map((item, i) => (
            <li key={i} style={{ color: 'var(--ls-muted)', fontSize: '1.0625rem', lineHeight: 1.7 }}>
              {item}
            </li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="ls-section" style={{ background: 'var(--ls-hero-bg)' }}>
        <div className="ls-container">
          <div className="max-w-3xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors hover:text-[var(--ls-blue-primary)]"
              style={{ color: 'var(--ls-muted)' }}
            >
              <ArrowLeft size={14} />
              Back to Blog
            </Link>

            <div className="flex items-center gap-3 mb-5">
              <span
                className="inline-block text-xs font-semibold px-3 py-1 rounded-full"
                style={{ background: 'var(--ls-blue-tint)', color: 'var(--ls-blue-primary)' }}
              >
                {post.category}
              </span>
              <span
                className="flex items-center gap-1 text-sm"
                style={{ color: 'var(--ls-muted)' }}
              >
                <Clock size={13} />
                {post.readTime}
              </span>
              <span className="text-sm" style={{ color: 'var(--ls-muted)' }}>
                {post.publishDate}
              </span>
            </div>

            <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 1.2 }}>
              {post.title}
            </h1>
          </div>
        </div>
      </section>

      {/* ── Article body ─────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <div className="max-w-3xl">
            {post.content.map((block, i) => renderBlock(block, i))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <div
            className="max-w-3xl rounded-2xl p-8 md:p-10"
            style={{ background: 'var(--ls-blue-tint)', border: '1.5px solid rgba(20,71,230,0.15)' }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'var(--ls-blue-primary)' }}
            >
              {post.cta.label}
            </p>
            <p
              className="text-lg font-semibold mb-6 leading-snug"
              style={{ color: 'var(--ls-text)' }}
            >
              {post.cta.description}
            </p>
            <Link href={post.cta.href} className="ls-btn-primary">
              {post.cta.buttonText} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Other posts ──────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <h2 className="text-2xl font-bold mb-8" style={{ color: 'var(--ls-text)' }}>
            More from the blog
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {blogPosts
              .filter((p) => p.slug !== post.slug)
              .slice(0, 3)
              .map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group flex flex-col rounded-xl border p-5 transition-shadow hover:shadow-md"
                  style={{ borderColor: 'var(--ls-border)', background: '#fff' }}
                >
                  <span
                    className="text-xs font-semibold mb-2"
                    style={{ color: 'var(--ls-blue-primary)' }}
                  >
                    {related.category}
                  </span>
                  <h3
                    className="text-base font-bold leading-snug mb-3 group-hover:text-[var(--ls-blue-primary)] transition-colors"
                    style={{ color: 'var(--ls-text)', fontSize: '1rem' }}
                  >
                    {related.title}
                  </h3>
                  <span
                    className="flex items-center gap-1 text-xs mt-auto"
                    style={{ color: 'var(--ls-muted)' }}
                  >
                    <Clock size={11} />
                    {related.readTime}
                  </span>
                </Link>
              ))}
          </div>
          <div className="mt-8">
            <Link href="/blog" className="ls-btn-outline">
              View all articles <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
