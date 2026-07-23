"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Calendar,
  PhoneCall,
  Download,
  ArrowRight,
  Clock3,
  MessageCircle,
} from "lucide-react";

interface Props {
  onClose?: () => void;
}

export default function SuccessScreen({ onClose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col"
    >
      {/* Top */}

      <div className="text-center">

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 180,
            damping: 14,
          }}
          className="
          mx-auto
          flex
          h-28
          w-28
          items-center
          justify-center
          rounded-full
          bg-gradient-to-br
          from-green-400
          to-green-600
          shadow-xl
          shadow-green-500/30
        "
        >
          <CheckCircle2
            size={60}
            className="text-white"
          />
        </motion.div>

        <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900">
          Registration Successful 
        </h2>

        <p className="mx-auto mt-3 max-w-md text-sm leading-4 text-slate-500">
          You're one step closer to becoming
          industry ready.
        </p>

      </div>

      {/* Timeline */}

      <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6">

        <h3 className="mb-6 text-lg font-bold text-slate-900">
          What happens next?
        </h3>

        <div className="space-y-6">

          <Timeline
            icon={<CheckCircle2 size={18} />}
            title="Registration Confirmed"
            text="Your demo request has been received successfully."
            active
          />

          <Timeline
            icon={<PhoneCall size={18} />}
            title="Career Expert Will Call You"
            text="Expect a call within the next 30–60 minutes."
          />

          <Timeline
            icon={<Calendar size={18} />}
            title="Attend Your Demo Session"
            text="Get your personalized roadmap and career guidance."
          />

        </div>

      </div>

      {/* Trust */}

    

      {/* CTA */}

      <div className="mt-8 space-y-3">

        <button
          className="
          group
          flex
          h-14
          w-full
          items-center
          justify-center
          gap-2
          rounded-2xl
          bg-[#165DFC]
          font-semibold
          text-white
          shadow-xl
          shadow-blue-600/20
          transition
          hover:-translate-y-1
        "
        >
          <Download size={18} />

          Download Course Brochure

          <ArrowRight
            size={17}
            className="transition group-hover:translate-x-1"
          />

        </button>

        <button
          className="
          flex
          h-14
          w-full
          items-center
          justify-center
          gap-2
          rounded-2xl
          border
          border-slate-200
          bg-white
          font-semibold
          transition
          hover:bg-slate-50
        "
        >
          <MessageCircle size={18} />

          Join Community

        </button>

      </div>

      <button
        onClick={onClose}
        className="
        mt-8
        text-center
        text-sm
        font-semibold
        text-blue-600
        hover:underline
      "
      >
        Continue Browsing →
      </button>

    </motion.div>
  );
}

function Timeline({
  icon,
  title,
  text,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  active?: boolean;
}) {
  return (
    <div className="flex gap-4">

      <div
        className={`
        mt-1
        flex
        h-10
        w-10
        items-center
        justify-center
        rounded-xl
        ${
          active
            ? "bg-green-100 text-green-600"
            : "bg-blue-100 text-blue-600"
        }
      `}
      >
        {icon}
      </div>

      <div>

        <h4 className="font-semibold text-slate-900">
          {title}
        </h4>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          {text}
        </p>

      </div>

    </div>
  );
}

function TrustCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">

      <p className="text-2xl font-black text-[#165DFC]">
        {value}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {label}
      </p>

    </div>
  );
}