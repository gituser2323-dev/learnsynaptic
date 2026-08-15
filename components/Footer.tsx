import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Mail, Phone } from 'lucide-react';

const programs = [
  { name: 'AI Full Stack Dev + DevOps', href: '/programs/full-stack-devops' },
  { name: 'GenAI Builder → Freelancer', href: '/programs/genai-builder' },
  { name: 'Data Science (AI/ML)', href: '/programs/data-science' },
  { name: 'AI Beginner Bootcamp', href: '/programs/bootcamp' },
];

const resources = [
  { name: 'All Programs', href: '/programs' },
  { name: 'Placements', href: '/placements' },
  { name: 'Internship Track', href: '/internship' },
  { name: 'Fees & EMI', href: '/pricing' },
  { name: 'Blog', href: '/blog' },
  { name: 'FAQ', href: '/faq' },
];

const company = [
  { name: 'About Us', href: '/about' },
  { name: 'Contact', href: '/contact' },
  { name: 'Testimonials', href: '/testimonials' },
];

export default function Footer() {
  return (
    <footer
      className="pt-16 pb-8"
      style={{ background: 'var(--ls-bg-alt)', borderTop: '1px solid var(--ls-border)' }}
    >
      <div className="ls-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center mb-3">
              <Image
                src="/logo-wordmark.png"
                alt="LearnSynaptic"
                height={32}
                width={99}
              />
            </Link>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--ls-muted)' }}>
              India&apos;s emerging tech training platform. From Pune, training students and
              professionals across India in AI, Full Stack, and Data Science.
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--ls-muted)' }}>
                <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--ls-blue-primary)' }} />
                <span>
                  {/* Office No. 201, Success Square, Karve Rd<br />
                  Kothrud, Pune, Maharashtra 411038
                  <br />
                  <span className="text-xs">Based in Pune. Training pan-India.</span> */}
                    
                    Saras Nagar,Ahilyanagar, Maharashtra 411001
                   
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ls-muted)' }}>
                <Phone size={14} style={{ color: 'var(--ls-blue-primary)' }} />
                <a href="tel:+919763969449" className="hover:text-ls-text transition-colors">
                +91 9119421273
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ls-muted)' }}>
                <Mail size={14} style={{ color: 'var(--ls-blue-primary)' }} />
                <a href="mailto:hello@learnsynaptic.com" className="hover:text-ls-text transition-colors">
                  hello@learnsynaptic.com
                </a>
              </div>
            </div>

            {/* Socials */}
            <div className="flex items-center gap-3 mt-5">
              {[
                {
                  href: 'https://linkedin.com/company/learnsynaptic',
                  label: 'LinkedIn',
                  svg: (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                      <circle cx="4" cy="4" r="2"/>
                    </svg>
                  ),
                },
                {
                  href: 'https://instagram.com/learnsynaptic',
                  label: 'Instagram',
                  svg: (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <circle cx="12" cy="12" r="4"/>
                      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
                    </svg>
                  ),
                },
                {
                  href: 'https://youtube.com/@learnsynaptic',
                  label: 'YouTube',
                  svg: (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58z"/>
                      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
                    </svg>
                  ),
                },
                {
                  href: 'https://twitter.com/learnsynaptic',
                  label: 'Twitter/X',
                  svg: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  ),
                },
              ].map(({ href, label, svg }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-8 h-8 rounded-md flex items-center justify-center border transition-colors"
                  style={{
                    border: '1px solid var(--ls-border)',
                    color: 'var(--ls-muted)',
                  }}
                >
                  {svg}
                </a>
              ))}
            </div>
          </div>

          {/* Programs */}
          <div>
            <h3
              className="text-sm font-semibold uppercase tracking-wider mb-4"
              style={{ color: 'var(--ls-text)' }}
            >
              Programs
            </h3>
            <ul className="space-y-2.5">
              {programs.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className="text-sm transition-colors"
                    style={{ color: 'var(--ls-muted)' }}
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3
              className="text-sm font-semibold uppercase tracking-wider mb-4"
              style={{ color: 'var(--ls-text)' }}
            >
              Resources
            </h3>
            <ul className="space-y-2.5">
              {resources.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="text-sm transition-colors"
                    style={{ color: 'var(--ls-muted)' }}
                  >
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3
              className="text-sm font-semibold uppercase tracking-wider mb-4"
              style={{ color: 'var(--ls-text)' }}
            >
              Company
            </h3>
            <ul className="space-y-2.5 mb-6">
              {company.map((c) => (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    className="text-sm transition-colors"
                    style={{ color: 'var(--ls-muted)' }}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>

            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--ls-blue-tint)' }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ls-text)' }}>
                Next batch starting soon
              </p>
              <p className="text-xs mb-3" style={{ color: 'var(--ls-muted)' }}>
                Limited seats available. Don&apos;t miss the July cohort.
              </p>
              <Link
                href="/programs"
                className="text-xs font-semibold"
                style={{ color: 'var(--ls-blue-primary)' }}
              >
                See all programs →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          style={{ borderTop: '1px solid var(--ls-border)', color: 'var(--ls-muted)' }}
        >
          <p>© {new Date().getFullYear()} LearnSynaptic. All rights reserved. Based in Pune, India.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-ls-text transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-ls-text transition-colors">
              Terms of Use
            </Link>
            <Link href="/refund-policy" className="hover:text-ls-text transition-colors">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
