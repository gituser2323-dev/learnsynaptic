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
  title: "FREE 7-Day AI Engineering Bootcamp — LearnSynaptic",
  description:
    "The Next Big Opportunity Starts With AI. Join LearnSynaptic's free 7-day live AI Engineering Bootcamp — 7 real projects shipped, 1:1 mentorship, zero cost.",
  openGraph: {
    title: "FREE 7-Day AI Engineering Bootcamp — LearnSynaptic",
    description:
      "Most people consume AI content. Very few build AI products. This free 7-day live bootcamp helps you become one of them.",
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
