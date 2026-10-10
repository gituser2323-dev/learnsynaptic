import type { Metadata } from "next";
import { AiBootcampLandingPage } from "@/components/ai-bootcamp/LandingPage";
import { aibInter, aibPoppins } from "@/app/fonts";

export const metadata: Metadata = {
  alternates: { canonical: '/ai-bootcamp' },
  title: "FREE 2-Hour Live AI Masterclass — LearnSynaptic",
  description:
    "The next big opportunity starts with the right skill. Join LearnSynaptic's free 2-hour live masterclass — built live, zero cost, zero fluff.",
  openGraph: {
    title: "FREE 2-Hour Live AI Masterclass — LearnSynaptic",
    description:
      "Most people consume AI content. Very few build AI products. This free 2-hour live masterclass helps you become one of them.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function AiBootcampPage() {
  return (
    <div className={`${aibPoppins.variable} ${aibInter.variable}`}>
      <AiBootcampLandingPage />
    </div>
  );
}
