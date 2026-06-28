"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, ShieldCheck, Users, Briefcase, Star } from "lucide-react";
import { useEffect } from "react";
import { useLeadModal } from "./LeadModalContext";
import LeadForm from "./LeadForm";

export default function LeadModal() {
  const { open, closeModal, options } = useLeadModal();

  // ESC key closes modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeModal();
      }
    }

    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKey);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, closeModal]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closeModal}
            className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md"
          />

          {/* Modal — scrollable on small screens since the content can
              exceed viewport height once both columns stack vertically */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center overflow-y-auto p-3 py-6 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="relative my-auto w-full max-w-5xl overflow-hidden rounded-[24px] bg-white shadow-[0_40px_120px_rgba(0,0,0,.30)] sm:rounded-[32px]"
            >
              {/* Close */}
              <button
                onClick={closeModal}
                aria-label="Close"
                className="absolute right-3 top-3 z-50 rounded-full border border-slate-200 bg-white p-1.5 transition hover:bg-slate-100 sm:right-5 sm:top-5 sm:p-2"
              >
                <X size={16} className="sm:hidden" />
                <X size={18} className="hidden sm:block" />
              </button>

              <div className="grid lg:grid-cols-2">
                {/* LEFT — collapses to a shorter, lighter panel on mobile
                    so the form (the actual conversion point) isn't pushed
                    far below the fold */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#165DFC] via-[#1457F0] to-[#0E46D5] px-6 py-8 text-white sm:p-8 lg:p-10">
                  {/* Glow */}
                  <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-[120px]" />

                  <div className="relative">
                    <div className="inline-flex rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-medium backdrop-blur sm:px-4 sm:py-2 sm:text-sm">
                      Admissions Open for Cohort
                    </div>

                    <h2 className="mt-4 text-2xl font-semibold leading-tight text-white sm:mt-6 sm:text-3xl lg:text-4xl" style={{color:"white"}}>
                      {options.title}
                    </h2>

                    <p className="mt-3 text-sm text-blue-100 sm:mt-5 sm:text-base lg:text-lg"  style={{color:"white"}}>
                      {options.subtitle}
                    </p>

                    {/* Trust — 2-column grid on mobile/tablet so it
                        doesn't stretch the panel unnecessarily tall,
                        single column from lg up where there's more
                        vertical room to work with anyway */}
                    <div className="mt-6 grid grid-cols-2 gap-4 sm:mt-8 lg:mt-10 lg:grid-cols-1 lg:gap-5">
                      <TrustItem icon={<Users size={16} />} title="3200+ Students Trained" />
                      <TrustItem icon={<Briefcase size={16} />} title="650+ Placements" />
                      <TrustItem icon={<Star size={16} />} title="4.9 Google Rating" />
                      <TrustItem icon={<ShieldCheck size={16} />} title="Industry Mentors" />
                    </div>

                    {/* Bottom checklist — hidden on the smallest screens
                        to keep the mobile modal from getting too tall;
                        reappears from sm up where there's room */}
                    <div className="mt-6 hidden rounded-2xl bg-white p-4 sm:mt-8 sm:block sm:p-5 lg:mt-12">
                      <p className="text-sm text-slate-900">✔ Live Classes</p>
                      <p className="mt-2 text-sm text-slate-900">✔ Internship Projects</p>
                      <p className="mt-2 text-sm text-slate-900">✔ Placement Assistance</p>
                    </div>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="bg-white p-5 sm:p-8 lg:p-10">
                  <LeadForm source="Lead Modal" />
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function TrustItem({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur sm:h-11 sm:w-11">
        {icon}
      </div>
      <span className="text-[13px] font-medium leading-tight sm:text-base lg:text-lg">
        {title}
      </span>
    </div>
  );
}