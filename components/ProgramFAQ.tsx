'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

export interface FAQItem {
  question: string;
  answer: string;
}

export function ProgramFAQ({ faqs }: { faqs: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div>
      {faqs.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            style={{ borderBottom: '1px solid var(--ls-border)' }}
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-start justify-between py-5 text-left gap-4"
            >
              <span
                className="font-semibold text-sm sm:text-base leading-snug"
                style={{ color: 'var(--ls-text)' }}
              >
                {faq.question}
              </span>
              <span
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                style={{
                  background: isOpen ? 'var(--ls-blue-primary)' : 'var(--ls-blue-tint)',
                  color: isOpen ? '#fff' : 'var(--ls-blue-primary)',
                  transition: 'background 200ms, color 200ms',
                }}
              >
                {isOpen ? <Minus size={12} /> : <Plus size={12} />}
              </span>
            </button>

            {isOpen && (
              <div className="pb-5">
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--ls-muted)', maxWidth: 640 }}
                >
                  {faq.answer}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
