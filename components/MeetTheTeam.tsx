'use client';

import Image from 'next/image';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';

const teamOne = {
  src: '/ai-mastermind/Team1.jpeg',
  width: 1600,
  height: 694,
  alt: 'Meet the team. Pratik Sabale, Co-Founder, AI Engineer and SDE. Vivek Vyvhare, AI Business Head. Priya, GenAI Engineer and AI Product Manager.',
};

const teamTwo = {
  src: '/ai-mastermind/Team2.png',
  width: 1905,
  height: 825,
  alt: 'Shruti, AI Freelancing Expert. Abhay, Business Coach.',
};

const growthRoadmap = {
  src: '/ai-mastermind/AI Growth Roadmap for Every Stage.png',
  width: 1672,
  height: 941,
  alt: 'Who is LearnSynaptic for? Students and freshers build job-ready AI skills and real projects. Working professionals use AI to accelerate their career. Founders and businesses automate workflows and build with AI.',
};

function Shot({
  src,
  width,
  height,
  alt,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
}) {
  return (
    <figure
      className="m-0 overflow-x-auto rounded-2xl border"
      style={{ borderColor: 'var(--ls-border)', background: 'var(--ls-background)' }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(max-width: 1100px) 100vw, 1100px"
        className="h-auto w-full min-w-[720px] md:min-w-0"
      />
    </figure>
  );
}

export function TeamPortraits() {
  return (
    <div className="flex flex-col gap-5">
      <Shot {...teamOne} />
      <Shot {...teamTwo} />
    </div>
  );
}

export function GrowthRoadmapImage() {
  return <Shot {...growthRoadmap} />;
}

export function MeetTheTeam() {
  return (
    <section className="ls-section" aria-labelledby="meet-the-team-heading">
      <div className="ls-container">
        <AnimateOnScroll className="mb-10 max-w-2xl">
          <span className="ls-badge mb-4 inline-flex">Meet the team</span>
          <h2 id="meet-the-team-heading" className="mb-3">
            The people who teach the cohorts
          </h2>
          <p style={{ color: 'var(--ls-muted)', maxWidth: 640 }}>
            Five practitioners in the live sessions: engineering, product, freelancing, and business coaching.
          </p>
        </AnimateOnScroll>
        <TeamPortraits />
      </div>
    </section>
  );
}

export function WhoItsForRoadmap() {
  return (
    <section className="ls-section" aria-labelledby="who-its-for-heading">
      <div className="ls-container">
        <AnimateOnScroll className="mb-10 max-w-2xl">
          <span className="ls-badge mb-4 inline-flex">Who it&apos;s for</span>
          <h2 id="who-its-for-heading" className="mb-3">
            A path for every stage
          </h2>
          <p style={{ color: 'var(--ls-muted)', maxWidth: 640 }}>
            Students building a first portfolio, professionals adding AI to the job they already have, and founders automating real work.
          </p>
        </AnimateOnScroll>
        <GrowthRoadmapImage />
      </div>
    </section>
  );
}
