'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  Bot,
  BarChart3,
  Brain,
  Zap,
  Info,
  Briefcase,
  GraduationCap,
  Wallet,
  BookOpen,
  HelpCircle,
  MessageCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrackClick } from '@/lib/services/analytics/useTrackClick';

const programs = [
  {
    name: 'AI Full Stack Dev + DevOps',
    href: '/programs/full-stack-devops',
    description: 'React + Node + AI + DevOps',
    icon: Bot,
  },
  {
    name: 'GenAI Builder → Freelancer',
    href: '/programs/genai-builder',
    description: 'LLMs • LangChain • RAG',
    icon: Zap,
  },
  {
    name: 'Data Science (AI/ML)',
    href: '/programs/data-science',
    description: 'Python • ML • AI',
    icon: Brain,
  },
  {
    name: 'AI Beginner Bootcamp',
    href: '/programs/bootcamp',
    description: 'Excel • SQL • Power BI',
    icon: BarChart3,
  },
];

export function getBatchDates() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const getBatchMondays = (y: number, m: number) => {
    const mondays: Date[] = [];
    const date = new Date(y, m, 1);

    while (date.getMonth() === m) {
      if (date.getDay() === 1) {
        mondays.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }

    return { first: mondays[0], third: mondays[2] };
  };

  const { first, third } = getBatchMondays(year, month);

  let nextBatch: Date;

  if (today <= first) {
    nextBatch = first;
  } else if (today <= third) {
    nextBatch = third;
  } else {
    const nextMonth =
      month === 11 ? getBatchMondays(year + 1, 0) : getBatchMondays(year, month + 1);
    nextBatch = nextMonth.first;
  }

  return nextBatch.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const nextBatch = getBatchDates();

const navLinks = [
  { name: 'About', href: '/about', icon: Info },
  { name: 'Placements', href: '/placements', icon: Briefcase },
  { name: 'Internship', href: '/internship', icon: GraduationCap },
  { name: 'Blog', href: '/blog', icon: BookOpen },
  { name: 'FAQ', href: '/faq', icon: HelpCircle },
];

export default function Navbar() {
  const trackClick = useTrackClick();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [announcementVisible, setAnnouncementVisible] = useState(true);
  const pathname = usePathname();

  // --- existing scroll/pathname effects, preserved exactly ---
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      // Announcement bar hides once the user has scrolled a bit further,
      // reappears back at the very top — purely presentational, doesn't
      // touch any existing nav state/logic.
      setAnnouncementVisible(window.scrollY < 80);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProgramsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Announcement bar — collapses on scroll, sits above the floating navbar */}
      <AnimatePresence>
        {announcementVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 36, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="fixed inset-x-0 top-0 z-[60] overflow-hidden bg-[#1447E6]"
          >
            <div className="mx-auto flex h-10 max-w-7xl items-center justify-center px-4">
              <p className="text-center text-xs font-medium text-white sm:text-sm" style={{color:"white"}}>
                <span className="sm:hidden">
                  Next Bootcamp: <span className="font-semibold">{nextBatch}</span>
                </span>

                <span className="hidden sm:inline">
                  • Next Bootcamp Starts{" "}
                  <span className="font-bold">{nextBatch}</span> • Reserve Your Seat Today
                </span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header
        className="fixed inset-x-0 z-50 transition-[top] duration-[250ms] ease-in-out"
        style={{ top: announcementVisible ? 'calc(36px + 8px)' : 16 }}
      >
        <div className="mx-auto max-w-7xl px-4">
          <motion.div
            initial={false}
            animate={{
              height: scrolled ? 64 : 72,
              boxShadow: scrolled
                ? '0 12px 40px rgba(15,23,42,0.10)'
                : '0 4px 20px rgba(15,23,42,0.05)',
            }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-visible rounded-[22px] border border-slate-200/70 bg-white/98 backdrop-blur-xl"
          >
            <nav className="flex h-full items-center justify-between px-5 sm:px-7">
              {/* Logo — extra left spacing, premium feel */}
              <Link href="/" className="flex items-center pl-1">
                <Image
                  src="/logo-wordmark.png"
                  alt="LearnSynaptic"
                  height={32}
                  width={99}
                  priority
                  className="transition-transform duration-200 hover:scale-[1.03]"
                />
              </Link>

              {/* Desktop Nav */}
              <div className="hidden lg:flex items-center gap-1">
                {/* Programs dropdown */}
                <div className="relative">
                  <button
                    className="flex items-center gap-1 rounded-full px-3.5 py-2 text-[14px] font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
                    onMouseEnter={() => setProgramsOpen(true)}
                    onMouseLeave={() => setProgramsOpen(false)}
                  >
                    Programs
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${programsOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {programsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 10, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="absolute left-0 top-full w-[420px] rounded-[20px] border border-slate-200/70 bg-white p-3 shadow-xl"
                        onMouseEnter={() => setProgramsOpen(true)}
                        onMouseLeave={() => setProgramsOpen(false)}
                      >
                        <div className="grid grid-cols-2 gap-2">
                          {programs.map((p) => {
                            const Icon = p.icon;
                            return (
                              <Link
                                key={p.href}
                                href={p.href}
                                className="group flex flex-col gap-2 rounded-2xl p-3.5 transition-colors duration-150 hover:bg-blue-50/70"
                              >
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1447E6] transition-colors duration-150 group-hover:bg-[#1447E6] group-hover:text-white">
                                  <Icon size={17} />
                                </span>
                                <span className="text-[13.5px] font-semibold leading-tight text-slate-900">
                                  {p.name}
                                </span>
                                <span className="text-[12px] leading-snug text-slate-500">
                                  {p.description}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                        <div className="mt-2 border-t border-slate-100 px-1 pt-3">
                          <Link
                            href="/programs"
                            className="flex items-center gap-1 px-2 text-[13px] font-semibold text-[#1447E6] hover:underline"
                          >
                            Compare all programs <ArrowRight size={13} />
                          </Link>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {navLinks.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`relative rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors duration-200 ${active
                          ? 'bg-blue-50 text-[#1447E6]'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active-pill"
                          className="absolute inset-0 -z-10 rounded-full bg-blue-50"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      {link.name}
                    </Link>
                  );
                })}
              </div>

              {/* Desktop CTA */}
              <div className="hidden lg:flex items-center gap-2">
                <Link
                  href="/contact"
                  className="rounded-full px-4 py-2 text-[14px] font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
                >
                  Talk to us
                </Link>
                <Link
                  href="/programs"
                  className="group flex items-center gap-1.5 rounded-xl bg-[#1447E6] px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(20,71,230,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-8px_rgba(20,71,230,0.65)]"
                  onClick={() => trackClick('enroll_now', 'navbar_desktop')}
                >
                  Enroll Now
                  <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Mobile toggle */}
              <button
                className="rounded-full p-2 text-slate-900 transition-colors hover:bg-slate-100 lg:hidden"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </nav>
          </motion.div>
        </div>

        {/* Mobile menu — premium slide-down panel */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="mx-auto max-w-7xl overflow-hidden px-4 lg:hidden"
            >
              <div className="mt-2 rounded-[20px] border border-slate-200/70 bg-white shadow-xl">
                <div className="flex flex-col gap-1 p-3">
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Programs
                  </p>
                  {programs.map((p) => {
                    const Icon = p.icon;
                    return (
                      <Link
                        key={p.href}
                        href={p.href}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1447E6]">
                          <Icon size={15} />
                        </span>
                        <span className="text-[14px] font-medium text-slate-900">{p.name}</span>
                      </Link>
                    );
                  })}

                  <div className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
                    {navLinks.map((link) => {
                      const Icon = link.icon;
                      const active = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${active ? 'bg-blue-50 text-[#1447E6]' : 'text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-blue-100 text-[#1447E6]' : 'bg-slate-100 text-slate-500'
                              }`}
                          >
                            <Icon size={15} />
                          </span>
                          {link.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-100 p-3">
                  <Link
                    href="/contact"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-[14px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <MessageCircle size={16} />
                    Book Free Demo
                  </Link>
                  <Link
                    href="/programs"
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#1447E6] px-4 py-3 text-[14px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(20,71,230,0.55)] transition-transform active:scale-[0.98]"
                    onClick={() => trackClick('enroll_now', 'navbar_mobile')}
                  >
                    Enroll Now
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}