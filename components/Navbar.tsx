'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const programs = [
  { name: 'AI Full Stack Dev + DevOps', href: '/programs/full-stack-devops' },
  { name: 'GenAI Builder → Freelancer', href: '/programs/genai-builder' },
  { name: 'Data Science (AI/ML)', href: '/programs/data-science' },
  { name: 'AI Beginner Bootcamp', href: '/programs/bootcamp' },
];

const navLinks = [
  { name: 'About', href: '/about' },
  { name: 'Placements', href: '/placements' },
  { name: 'Internship', href: '/internship' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Blog', href: '/blog' },
  { name: 'FAQ', href: '/faq' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProgramsOpen(false);
  }, [pathname]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-200 ${
        scrolled ? 'shadow-[0_1px_0_0_#e4e4e7]' : ''
      }`}
    >
      <div className="ls-container">
        <nav className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-[1.1rem] text-ls-text">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--ls-blue-primary)' }}
            >
              <Zap size={16} color="#fff" strokeWidth={2.5} />
            </span>
            <span style={{ color: 'var(--ls-text)' }}>
              Learn<span style={{ color: 'var(--ls-blue-primary)' }}>Synaptic</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Programs dropdown */}
            <div className="relative">
              <button
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-ls-muted hover:text-ls-text rounded-md transition-colors"
                onMouseEnter={() => setProgramsOpen(true)}
                onMouseLeave={() => setProgramsOpen(false)}
                style={{ color: 'var(--ls-muted)' }}
              >
                Programs
                <ChevronDown
                  size={14}
                  className={`transition-transform ${programsOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {programsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl border p-2 shadow-lg"
                    style={{ borderColor: 'var(--ls-border)' }}
                    onMouseEnter={() => setProgramsOpen(true)}
                    onMouseLeave={() => setProgramsOpen(false)}
                  >
                    {programs.map((p) => (
                      <Link
                        key={p.href}
                        href={p.href}
                        className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-[#f8fafc] transition-colors"
                        style={{ color: 'var(--ls-text)' }}
                      >
                        {p.name}
                      </Link>
                    ))}
                    <div
                      className="mt-2 pt-2 px-3 pb-1"
                      style={{ borderTop: '1px solid var(--ls-border)' }}
                    >
                      <Link
                        href="/programs"
                        className="text-xs font-semibold"
                        style={{ color: 'var(--ls-blue-primary)' }}
                      >
                        Compare all programs →
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium rounded-md transition-colors"
                style={{
                  color: pathname === link.href ? 'var(--ls-blue-primary)' : 'var(--ls-muted)',
                }}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/contact" className="text-sm font-medium" style={{ color: 'var(--ls-muted)' }}>
              Talk to us
            </Link>
            <Link href="/programs" className="ls-btn-primary text-sm py-2 px-4">
              Enroll Now
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 rounded-md"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            style={{ color: 'var(--ls-text)' }}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden overflow-hidden bg-white border-t"
            style={{ borderColor: 'var(--ls-border)' }}
          >
            <div className="ls-container py-4 flex flex-col gap-1">
              <p
                className="text-xs font-semibold uppercase tracking-wider px-3 py-2"
                style={{ color: 'var(--ls-muted)' }}
              >
                Programs
              </p>
              {programs.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium"
                  style={{ color: 'var(--ls-text)' }}
                >
                  {p.name}
                </Link>
              ))}
              <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--ls-border)' }}>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-3 py-2.5 rounded-lg text-sm font-medium"
                    style={{ color: 'var(--ls-text)' }}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
              <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--ls-border)' }}>
                <Link href="/contact" className="ls-btn-outline text-center">
                  Talk to us
                </Link>
                <Link href="/programs" className="ls-btn-primary text-center">
                  Enroll Now
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
