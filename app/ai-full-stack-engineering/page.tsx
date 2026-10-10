import type { Metadata } from "next";
import { AiFullStackLandingPage } from "@/components/ai-full-stack-engineering/LandingPage";
import { aibInter, aibPoppins } from "@/app/fonts";

export const metadata: Metadata = {
  alternates: { canonical: '/ai-full-stack-engineering' },
  title: "FREE 2-Hour AI Full Stack Engineering Masterclass — LearnSynaptic",
  description:
    "Your degree won't get you hired in 2027. Your portfolio will. Join LearnSynaptic's free 2-hour live AI Full Stack Engineering masterclass — built live, zero cost, zero fluff.",
  openGraph: {
    title: "FREE 2-Hour AI Full Stack Engineering Masterclass — LearnSynaptic",
    description:
      "Most CS students memorize DSA. Very few ship AI-integrated products. This free 2-hour live masterclass helps you become one of them.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function AiFullStackEngineeringPage() {
  return (
    <div className={`${aibPoppins.variable} ${aibInter.variable}`}>
      <AiFullStackLandingPage />
    </div>
  );
}
