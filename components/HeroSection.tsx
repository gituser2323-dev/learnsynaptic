"use client";

import {
  Calendar,
  Star,
  Users,
  Briefcase,
  ArrowRight,
  Download,
} from "lucide-react";



const nextBatch = getBatchDates();


import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const careers = [
  "AI Full Stack + Devops",
  "Data Analytics",
  "Data Science",
  "Generative AI",
  "AI Engineer"
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
    <div className="max-w-3xl ">
      <h1
        className="
mt-4
max-w-[680px]
text-2xl
sm:text-3xl
lg:text-3xl
font-black
text-slate-900
">        <span className="block">Build The Skills in</span>

        <div className="relative mt-2 h-[60px] sm:h-[72px] lg:h-[96px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={careers[index]}
              initial={{ opacity: 0, y: 35 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -35 }}
              transition={{
                duration: 0.45,
                ease: "easeOut",
              }}
              className="absolute left-0 top-0 block bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 bg-clip-text text-transparent"
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

  const getBatchMondays = (year: number, month: number) => {
    const mondays: Date[] = [];

    const date = new Date(year, month, 1);

    while (date.getMonth() === month) {
      if (date.getDay() === 1) {
        mondays.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }

    return {
      first: mondays[0],
      third: mondays[2],
    };
  };

  let { first, third } = getBatchMondays(year, month);

  // Find the next upcoming batch
  let nextBatch: Date;

  if (today <= first) {
    nextBatch = first;
  } else if (today <= third) {
    nextBatch = third;
  } else {
    // Move to next month
    const nextMonth =
      month === 11
        ? getBatchMondays(year + 1, 0)
        : getBatchMondays(year, month + 1);

    nextBatch = nextMonth.first;
  }

  return nextBatch.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#ffffff_55%)]">

      <div className="max-w-7xl mx-auto px-6 py-14 lg:py-16">

        <div className="grid lg:grid-cols-2 gap-14 items-center">

          {/* LEFT */}

          <div className="max-w-2xl mx-auto lg:mx-0 py-6 lg:py-10 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
              <Calendar className="h-4 w-4" />
              Admissions Open • Next Batch Starts <span className="font-bold">{nextBatch}</span>
            </div>

            <AnimatedHeadline />

            <p className=" max-w-2xl text-5lg leading-8 text-slate-600">
              Learn from{" "}
              <span className="font-semibold text-slate-900">
                industry experts
              </span>
              , work on{" "}
              <span className="font-semibold text-slate-900">
                live projects
              </span>
              , complete{" "}
              <span className="font-semibold text-slate-900">
                internship training
              </span>
              , and receive{" "}
              <span className="font-semibold text-slate-900">
                end-to-end placement assistance
              </span>{" "}
              to confidently launch your career in tech.
            </p>
            {/* Trust */}

            <div className="mt-10 flex flex-wrap gap-8">
              <div className="flex gap-3">
                <Star className="text-yellow-500" />
                <div>
                  <p className="font-bold">4.5/5 Rating</p>
                  <p className="text-sm text-gray-500">
                    Google Reviews
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Users className="text-blue-600" />
                <div>
                  <p className="font-bold">3200+</p>
                  <p className="text-sm text-gray-500">
                    Students Trained
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Briefcase className="text-blue-600" />
                <div>
                  <p className="font-bold">650+</p>
                  <p className="text-sm text-gray-500">
                    Placements
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Users className="text-blue-600" />
                <div>
                  <p className="font-bold">120+</p>
                  <p className="text-sm text-gray-500">
                    Hiring Partners
                  </p>
                </div>
              </div>

            </div>

            {/* CTA */}

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button className="bg-blue-600 hover:bg-blue-700 transition text-white rounded-2xl
h-14
px-8
font-semibold px-7 py-4 font-semibold flex items-center gap-2 ">

                Book Free Demo

                <ArrowRight size={18} />

              </button>

              <button className="border rounded-2xl
h-14
px-8
 w-full sm:w-auto rounded-2xl
font-semibold px-7 py-4 font-semibold hover:bg-gray-50 flex items-center gap-2">

                Download Syllabus

                <Download size={18} />

              </button>

            </div>

            <div className="mt-8 flex justify-center lg:justify-start items-center gap-4">
              <div className="flex -space-x-3">

                {["1", "2", "3", "4", "5"].map((id) => (
                  <img
                    key={id}
                    src={`/students/${id}.jpg`}
                    className="w-10 h-10 w-full  sm:w-auto rounded-full border-2 border-white"
                  />
                ))}

              </div>

              <p className="text-sm text-slate-500">

                Trusted by

                <span className="mx-1 font-bold text-slate-900">
                  3200+
                </span>

                learners across India

              </p>

            </div>

          </div>



          {/* RIGHT */}

          <div >

            <div className="rounded-3xl overflow-hidden shadow-2xl border bg-white">

              <div className="aspect-video">

                <video
                  controls
                  poster="/student.jpg"
                  className="w-full h-full object-cover rounded-3xl"
                >

                  <source src="/videos/testimonial.mp4" />

                </video>

              </div>


            </div>

          </div>

        </div>






      </div>
    </section>
  );
}