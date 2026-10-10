import type { Metadata } from "next";
import { AiGeneralistLandingPage } from "@/components/ai-generalist/LandingPage";
import { aigInter, aigPoppins } from "@/app/fonts";

export const metadata: Metadata = {
  alternates: { canonical: '/ai-generalist' },
  title: "FREE 7-Day AI for Business Bootcamp — LearnSynaptic",
  description:
    "AI is no longer optional. It's essential. Join LearnSynaptic's free 7-day live AI for Business Bootcamp and get back 10+ hours a week with zero coding.",
  openGraph: {
    title: "FREE 7-Day AI for Business Bootcamp — LearnSynaptic",
    description:
      "Most business owners consume AI content. Very few use it to run their business. This free 7-day live bootcamp helps you become one of them — zero coding required.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function AiGeneralistPage() {
  return (
    <div className={`${aigPoppins.variable} ${aigInter.variable}`}>
      <AiGeneralistLandingPage />
    </div>
  );
}
