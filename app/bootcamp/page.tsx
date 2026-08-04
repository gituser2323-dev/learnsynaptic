import type { Metadata } from 'next';
import { getNextBootcampStart, formatBatchDate } from '@/lib/bootcampDates';
import { SITE_URL } from '@/config/site';
import { ChapterHero } from '@/components/bootcamp/chapters/Chapter01Hero';
import { ChapterReckoning } from '@/components/bootcamp/chapters/Chapter02Reckoning';
import { ChapterWhyNow } from '@/components/bootcamp/chapters/Chapter03WhyNow';
import { ChapterPath } from '@/components/bootcamp/chapters/Chapter04Path';
import { ChapterMindset } from '@/components/bootcamp/chapters/Chapter03Mindset';
import { ChapterJourney } from '@/components/bootcamp/chapters/Chapter04Journey';
import { ChapterPortfolio } from '@/components/bootcamp/chapters/Chapter06Portfolio';
import { ChapterCommunity } from '@/components/bootcamp/chapters/Chapter08Community';
import { ChapterBuilders } from '@/components/bootcamp/chapters/Chapter05Builders';
import { ChapterAfterRegister } from '@/components/bootcamp/chapters/Chapter10AfterRegister';
import { ChapterRegister } from '@/components/bootcamp/chapters/Chapter07Register';
import { ChapterFinalCTA } from '@/components/bootcamp/chapters/Chapter12FinalCTA';
import { StickyCTA } from '@/components/bootcamp/StickyCTA';

export const metadata: Metadata = {
  alternates: { canonical: '/bootcamp' },
  title: 'FREE AI Full Stack + GenAI Bootcamp — 7 Days Live | LearnSynaptic',
  description:
    'Join LearnSynaptic\'s FREE 7-day LIVE AI Full Stack Bootcamp. Build real AI applications with React, Node.js, OpenAI APIs, MCP, and Cursor AI. Limited seats, zero cost.',
  keywords: [
    'free AI bootcamp India', 'AI full stack bootcamp', 'generative AI bootcamp free',
    'learn OpenAI API', 'MCP AI agents course', 'Cursor AI bootcamp', 'free live AI course India',
  ],
  openGraph: {
    title: 'Stop Watching Tutorials. Start Shipping AI Products. — LearnSynaptic',
    description:
      'A free, 7-day live bootcamp where you build real AI products — not watch someone else build them.',
    type: 'website',
  },
};

export default function BootcampPage() {
  const batchStart = getNextBootcampStart();
  const batchDateLabel = formatBatchDate(batchStart);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'FREE AI Full Stack + Generative AI Bootcamp',
    description:
      'A 7-day live bootcamp teaching AI application development with React, Node.js, OpenAI APIs, MCP, and Cursor AI.',
    provider: {
      '@type': 'Organization',
      name: 'LearnSynaptic',
      sameAs: SITE_URL,
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      availability: 'https://schema.org/LimitedAvailability',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'P7D',
      startDate: batchStart.toISOString(),
    },
  };

  return (
    <div className="builders">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ChapterHero batchDateLabel={batchDateLabel} target={batchStart} />
      <ChapterReckoning />
      <ChapterWhyNow />
      <ChapterPath />
      <ChapterMindset />
      <ChapterJourney />
      <ChapterPortfolio />
      <ChapterCommunity />
      <ChapterBuilders />
      <ChapterAfterRegister />
      <ChapterRegister target={batchStart} batchDateLabel={batchDateLabel} />
      <ChapterFinalCTA batchDateLabel={batchDateLabel} />

      <StickyCTA batchDateLabel={batchDateLabel} />
    </div>
  );
}
