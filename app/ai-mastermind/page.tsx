import type { Metadata } from "next";
import { AiMastermindLandingPage } from "@/components/ai-mastermind/LandingPage";
import { aibInter, aibPoppins } from "@/app/fonts";

export const metadata: Metadata = {
  alternates: { canonical: "/ai-mastermind" },
  title: "1-Day AI Mastermind — LearnSynaptic",
  description:
    "One day. Seven live expert modules. Build AI apps, use coding agents, automate work and analyse data with AI — hands-on with LearnSynaptic.",
  openGraph: {
    title: "1-Day AI Mastermind — LearnSynaptic",
    description: "One day, seven live modules: AI apps, coding agents, automation, AI agents and data analysis.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function AiMastermindPage() {
  return (
    <div className={`${aibPoppins.variable} ${aibInter.variable}`}>
      <AiMastermindLandingPage />
    </div>
  );
}
