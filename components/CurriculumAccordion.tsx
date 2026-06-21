'use client';

import { useState } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';

export interface CurriculumModule {
  title: string;
  duration: string;
  description: string;
  topics: string[];
}

export function CurriculumAccordion({ modules }: { modules: CurriculumModule[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {modules.map((mod, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--ls-border)' }}
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left bg-white transition-colors hover:bg-[#F8FAFC]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    background: isOpen ? 'var(--ls-blue-primary)' : 'var(--ls-blue-tint)',
                    color: isOpen ? '#fff' : 'var(--ls-blue-primary)',
                    transition: 'background 200ms, color 200ms',
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className="font-semibold text-sm sm:text-base truncate"
                  style={{ color: 'var(--ls-text)' }}
                >
                  {mod.title}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span className="hidden sm:block text-xs font-medium" style={{ color: 'var(--ls-muted)' }}>
                  {mod.duration}
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    color: 'var(--ls-muted)',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms',
                  }}
                />
              </div>
            </button>

            {isOpen && (
              <div
                className="px-5 pb-5 pt-1 border-t"
                style={{ borderColor: 'var(--ls-border)', background: '#FAFBFE' }}
              >
                <p className="text-sm mb-3 mt-3" style={{ color: 'var(--ls-muted)' }}>
                  {mod.description}
                </p>
                <ul className="space-y-1.5">
                  {mod.topics.map((topic, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <ArrowRight
                        size={13}
                        className="mt-0.5 shrink-0"
                        style={{ color: 'var(--ls-blue-primary)' }}
                      />
                      <span style={{ color: 'var(--ls-text)' }}>{topic}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
