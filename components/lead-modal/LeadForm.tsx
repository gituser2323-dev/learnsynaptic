"use client";

import { useState } from "react";
import {
  User,
  Phone,
  Mail,
  GraduationCap,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";

import SuccessScreen from "./SuccessScreen";
import { useLeadModal } from "./LeadModalContext";
import { sendLeadEmail } from "@/app/utils/email";

const programs = [
  "AI Full Stack + DevOps",
  "Data Analytics",
  "Data Science",
  "Generative AI",
  "AI Engineer",
];

const benefits = [
  "Career roadmap",
  "Live class experience",
  "Placement guidance",
  "No payment required",
];

interface LeadFormProps {
  /** Where this form instance lives, e.g. "Hero", "Footer", "Pricing Page".
   *  Passed through to the lead email so you can see which part of the
   *  site is actually driving signups. Defaults to "Website" if omitted. */
  source?: string;
}

export default function LeadForm({ source = "Website" }: LeadFormProps) {
  const { closeModal } = useLeadModal();

  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    program: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: false });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, boolean> = {
      name: !form.name,
      phone: !form.phone,
      email: !form.email,
      program: !form.program,
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean)) return;

    try {
      setLoading(true);

      await sendLeadEmail({
        name: form.name,
        phone: form.phone,
        email: form.email,
        program: form.program,
        source,
      });

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setErrors({ submit: true });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return <SuccessScreen />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Input
        icon={<User size={18} />}
        placeholder="Full Name"
        name="name"
        value={form.name}
        onChange={handleChange}
        error={errors.name}
      />

      <Input
        icon={<Phone size={18} />}
        placeholder="Mobile Number"
        name="phone"
        type="tel"
        value={form.phone}
        onChange={handleChange}
        error={errors.phone}
      />

      <Input
        icon={<Mail size={18} />}
        placeholder="Email Address"
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        error={errors.email}
      />

      {/* Program */}
      <div className="relative">
        <GraduationCap
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 sm:left-5"
        />
        <select
          name="program"
          value={form.program}
          onChange={handleChange}
          className={`h-12 w-full appearance-none rounded-2xl border bg-white pl-12 pr-4 text-sm font-medium outline-none transition focus:ring-4 sm:h-14 sm:pl-14 ${
            errors.program
              ? "border-red-300 focus:border-red-400 focus:ring-red-100"
              : "border-slate-200 focus:border-[#165DFC] focus:ring-blue-100"
          }`}
        >
          <option value="">Select Program</option>
          {programs.map((program) => (
            <option key={program}>{program}</option>
          ))}
        </select>
      </div>

      {/* Benefits — premium card, icon-led list instead of plain checkmarks */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-blue-50/40 p-4 sm:p-5">
        <p className="text-[14px] font-semibold text-slate-900 sm:text-[15px]">
          Your free demo includes
        </p>
        <ul className="mt-3 space-y-2">
          {benefits.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-[13px] text-slate-600 sm:text-sm"
            >
              <CheckCircle2 size={15} className="shrink-0 text-[#165DFC]" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Button */}
      <button
        type="submit"
        disabled={loading}
        className="group flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#165DFC] text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 disabled:translate-y-0 disabled:opacity-70 sm:h-14 sm:text-base"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Reserving...
          </>
        ) : (
          <>
            Reserve My Free Demo
            <ArrowRight
              size={18}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </>
        )}
      </button>

      {errors.submit && (
        <p className="text-center text-xs font-medium text-red-500">
          Something went wrong. Please try again.
        </p>
      )}

      <p className="text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
        By continuing, you agree to receive updates via WhatsApp, email and
        phone.
      </p>
    </form>
  );
}

function Input({
  icon,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 sm:left-5">
        {icon}
      </div>
      <input
        {...props}
        className={`h-12 w-full rounded-2xl border bg-white pl-12 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:ring-4 sm:h-14 sm:pl-14 ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 focus:border-[#165DFC] focus:ring-blue-100"
        }`}
      />
    </div>
  );
}