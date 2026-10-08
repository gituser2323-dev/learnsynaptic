import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import { AiMastermindLandingPage } from "@/components/ai-mastermind/LandingPage";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--aib-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--aib-inter",
  display: "swap",
});

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
    <div className={`${poppins.variable} ${inter.variable}`}>
      <AiMastermindLandingPage />
    </div>
  );
}
