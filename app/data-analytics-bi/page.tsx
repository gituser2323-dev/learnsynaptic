import type { Metadata } from "next";
import { DataAnalyticsLandingPage } from "@/components/data-analytics-bi/LandingPage";
import { aibInter, aibPoppins } from "@/app/fonts";

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
    <div className={`${aibPoppins.variable} ${aibInter.variable}`}>
      <DataAnalyticsLandingPage />
    </div>
  );
}
