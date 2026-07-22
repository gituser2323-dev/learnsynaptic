'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Magnetic } from './chapters/primitives';

export function StickyCTA({ batchDateLabel }: { batchDateLabel: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 700);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
          className="fixed bottom-0 left-0 right-0 z-40 b-glass"
          style={{ borderTop: '1px solid var(--b-line-dark)' }}
        >
          <div className="b-container flex items-center justify-between gap-4 py-3">
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-bold truncate">FREE AI Full Stack + GenAI Bootcamp</p>
              <p className="text-xs truncate b-muted">Batch starts {batchDateLabel} — limited seats</p>
            </div>
            <Magnetic strength={0.15}>
              <a
                href="#register"
                className="b-btn-primary justify-center shrink-0"
                style={{ fontSize: '0.875rem', padding: '0.75rem 1.5rem' }}
              >
                Reserve My FREE Seat <ArrowRight size={15} />
              </a>
            </Magnetic>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
