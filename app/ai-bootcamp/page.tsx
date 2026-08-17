import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import { AiBootcampLandingPage } from "@/components/ai-bootcamp/LandingPage";

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
    <div className={`${poppins.variable} ${inter.variable}`}>
      <AiBootcampLandingPage />
    </div>
  );
}
