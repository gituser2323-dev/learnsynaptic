"use client";

import {
  Calendar,
  Star,
  Users,
  Briefcase,
  ArrowRight,
  Download,
} from "lucide-react";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useLeadModal } from "./lead-modal";

const careers = [
  "AI Full Stack + Devops",
  "Data Analytics",
  "Data Science",
  "Generative AI",
  "AI Engineer",
];


function AnimatedHeadline() {

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % careers.length);
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto max-w-3xl lg:mx-0">
      <h1 className="mt-4 max-w-[680px] font-black text-slate-900 text-[1.6rem] sm:text-6xl lg:text-5xl">
        <span className="block">Build The Skill in</span>

        <div className="relative mt-0 flex h-[36px] items-center justify-center overflow-hidden text-left sm:h-[56px] sm:justify-center lg:h-[72px] lg:justify-start">
          <AnimatePresence mode="wait">
            <motion.span
              key={careers[index]}
              initial={{ opacity: 0, y: 35 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -35 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="absolute whitespace-nowrap bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 bg-clip-text text-[1.9rem] text-transparent sm:text-6xl lg:text-5xl"
            >
              {careers[index]}
            </motion.span>
          </AnimatePresence>
        </div>
      </h1>
    </div>
  );
}

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

const trustStats = [
  { icon: Star, value: "4.5/5 Rating", label: "Google Reviews", color: "text-yellow-500" },
  { icon: Users, value: "3200+", label: "Students Trained", color: "text-blue-600" },
  { icon: Briefcase, value: "650+", label: "Placements", color: "text-blue-600" },
];

const techs = [
  { name: "JavaScript", logo: "/logo/JavaScript.svg" },
  { name: "Next.js", logo: "/logo/Next.js.svg" },
  { name: "Express", logo: "/logo/Express.svg" },
  { name: "MongoDB", logo: "/logo/MongoDB.svg" },
  { name: "MySQL", logo: "/logo/MySQL.svg" },
  { name: "Python", logo: "/logo/Python.svg" },
  { name: "Pandas", logo: "/logo/Pandas.svg" },
  { name: "NumPy", logo: "/logo/NumPy.svg" },
  { name: "OpenAI", logo: "/logo/openai.svg" },
  { name: "Claude", logo: "/logo/claude-color.svg" },
  { name: "Gemini", logo: "/logo/gemini-color.svg" },
  { name: "Hugging Face", logo: "/logo/huggingface-color.svg" },
  { name: "Ollama", logo: "/logo/ollama.svg" },
  { name: "AWS", logo: "/logo/AWS.svg" },
  { name: "Runway", logo: "/logo/runway.svg" },
];
function TechMarquee() {
  const items = [...techs, ...techs];

  return (
    <div className="relative overflow-hidden rounded-b-3xl border-t border-slate-200">

      {/* Left Fade */}

      <div className="py-4">

        <div className="flex animate-marquee w-max items-center gap-8">

          {items.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="group flex shrink-0 items-center gap-2 rounded-full px-3 py-2 transition-all duration-300 hover:bg-blue-50"
            >
              <img
                src={item.logo}
                alt={item.name}
                className="h-7 w-7 object-contain transition-transform duration-300 group-hover:scale-110"
              />

              <span className="whitespace-nowrap text-sm font-medium text-slate-700">
                {item.name}
              </span>

              <div className="ml-3 h-1.5 w-1.5 rounded-full bg-slate-300" />
            </div>
          ))}

        </div>

      </div>

    </div>
  );
}
export default function Hero() {

const { openModal } = useLeadModal();


  // pt-[88px] on the section clears a typical fixed navbar (logo + nav
  // + CTA button height) — adjust this number to match your navbar's
  // actual rendered height, check in DevTools rather than guessing.
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#ffffff_55%)] pt-[58px] lg:pt-0">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-10 lg:pt-25">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* LEFT */}
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:py-18 lg:text-left">
            {/* <div className="mx-auto inline-flex w-fit flex-wrap items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-700 sm:text-sm lg:mx-0">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                Admissions Open • Next Batch Starts{" "}
                <span className="font-bold">{nextBatch}</span>
              </span>
            </div> */}

            <AnimatedHeadline />

            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8 lg:mx-0">
              Learn from{" "}
              <span className="font-semibold text-slate-900">industry experts</span>,
              work on <span className="font-semibold text-slate-900">live projects</span>,
              complete{" "}
              <span className="font-semibold text-slate-900">internship training</span>,
              and receive{" "}
              <span className="font-semibold text-slate-900">
                end-to-end placement assistance
              </span>{" "}
              to confidently launch your career in tech.
            </p>

            {/* Trust stats — single column on the narrowest phones
                (under ~400px) so numbers/labels never get cramped,
                2-column from "sm" up, free-flowing row on desktop */}
            <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-5 sm:mt-8 sm:max-w-none sm:flex sm:flex-wrap sm:justify-center sm:gap-8 lg:mt-10 lg:justify-start">
              {trustStats.map(({ icon: Icon, value, label, color }) => (
                <div key={label} className="flex items-center justify-center gap-3 sm:justify-start">
                  <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                  <div className="text-left">
                    <p className="font-bold leading-tight">{value}</p>
                    <p className="text-sm text-gray-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            {/* pb-20 on mobile only, clears the fixed WhatsApp floating
                button so the two never visually overlap */}
            {/* CTA */}
            {/* pb-20 on mobile only, clears the fixed WhatsApp floating
    button so the two never visually overlap */}
            <div className="mx-auto mt-4 max-w-sm pb-0 sm:mt-8 sm:max-w-none sm:pb-0 lg:mt-10">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4 lg:justify-start">
                <button   onClick={() =>
    openModal({
      title: "Reserve Your Free Demo",
      program: "",
      source: "Hero CTA",
    })
  } className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 sm:h-14 sm:px-7 sm:text-base">
                  Reserve Your Free Demo      <ArrowRight size={18} />
                </button>

                <button className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border px-6 text-sm font-semibold hover:bg-gray-50 sm:h-14 sm:w-auto sm:px-7 sm:text-base">
                  Download Syllabus
                  <Download size={18} />
                </button>
              </div>


              {/* Honest urgency — references the real next-batch date
      already computed above, not a fabricated countdown */}
              <div className="mt-3 flex items-center justify-center gap-2 sm:justify-center lg:justify-start">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" />
                <p className="text-[13px] text-slate-700">
                  Limited live-cohort seats for the{" "}
                  <span className="font-semibold">{nextBatch}</span> batch
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col items-center justify-center gap-1.5 sm:flex-row sm:justify-center sm:gap-3 lg:justify-start">
              <div className="flex -space-x-2.5 sm:-space-x-3">
                {["1", "2", "3", "4", "5"].map((id) => (
                  <img
                    key={id}
                    src={`/students/${id}.jpg`}
                    alt=""
                    className="h-8 w-8 rounded-full border-2 border-white object-cover sm:h-10 sm:w-10"
                  />
                ))}
              </div>

              <p className="text-sm text-slate-500">
                Trusted by{" "}
                <span className="mx-1 font-bold text-slate-900">3200+</span>
                learners across India
              </p>
            </div>
          </div>


          {/* RIGHT */}
          <div className="mt-2 lg:mt-0">
            <div className="overflow-hidden rounded-2xl border bg-white shadow-2xl sm:rounded-3xl">
              <div className="aspect-video">
                <video
                  controls
                  poster="/student.jpg"
                  className="h-full w-full rounded-2xl object-cover sm:rounded-3xl"
                >
                  <source src="/videos/testimonial.mp4" />
                </video>
              </div>
            </div>
            <div className="mt-6">
              <TechMarquee />
            </div>


          </div>

        </div>
      </div>
    </section>
  );
}