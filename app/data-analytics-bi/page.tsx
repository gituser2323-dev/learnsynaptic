import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import { DataAnalyticsLandingPage } from "@/components/data-analytics-bi/LandingPage";

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
  alternates: { canonical: '/data-analytics-bi' },
  title: "FREE 2-Hour Data Analytics & BI Masterclass — LearnSynaptic",
  description:
    "Data will decide who gets promoted in 2027. Join LearnSynaptic's free 2-hour live Data Analytics & BI masterclass — built live, zero cost, zero fluff.",
  openGraph: {
    title: "FREE 2-Hour Data Analytics & BI Masterclass — LearnSynaptic",
    description:
      "Most analysts stare at spreadsheets. Very few build dashboards leadership trusts. This free 2-hour live masterclass helps you become one of them.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function DataAnalyticsBiPage() {
  return (
    <div className={`${poppins.variable} ${inter.variable}`}>
      <DataAnalyticsLandingPage />
    </div>
  );
}
