import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import { GenaiLandingPage } from "@/components/genai/LandingPage";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--aib-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--aib-inter",
  display: "swap",
});

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
    <div className={`${poppins.variable} ${inter.variable}`}>
      <GenaiLandingPage />
    </div>
  );
}
