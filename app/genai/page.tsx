import type { Metadata } from "next";
import { GenaiLandingPage } from "@/components/genai/LandingPage";
import { aibInter, aibPoppins } from "@/app/fonts";

export const metadata: Metadata = {
  alternates: { canonical: '/genai' },
  title: "FREE 2-Hour GenAI Masterclass — LearnSynaptic",
  description:
    "You have the job today. Will you have the skill for 2027? Join LearnSynaptic's free 2-hour live GenAI masterclass — built live, zero cost, zero fluff.",
  openGraph: {
    title: "FREE 2-Hour GenAI Masterclass — LearnSynaptic",
    description:
      "Most professionals still just prompt ChatGPT. Very few ship production GenAI. This free 2-hour live masterclass helps you become one of them.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function GenaiPage() {
  return (
    <div className={`${aibPoppins.variable} ${aibInter.variable}`}>
      <GenaiLandingPage />
    </div>
  );
}
