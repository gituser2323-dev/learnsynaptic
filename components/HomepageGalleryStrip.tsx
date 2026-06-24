import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  AnimateOnScroll,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui/AnimateOnScroll';

const photos = [
  {
    src: '/gallery/05-office-team-coding-1.jpeg',
    alt: 'Team coding together at the LearnSynaptic office — a typical afternoon',
    sizes: '(max-width: 768px) 50vw, 38vw',
  },
  {
    src: '/gallery/09-teaching-lab-session.jpeg',
    alt: 'Pratik leading a hands-on coding session with students in the lab',
    sizes: '(max-width: 768px) 50vw, 20vw',
  },
  {
    src: '/gallery/01-faculty-visit-group.jpeg',
    alt: 'Faculty and industry guests visiting and joining a session with the team',
    sizes: '(max-width: 768px) 50vw, 20vw',
  },
  {
    src: '/gallery/07-office-team-coding-2.jpeg',
    alt: 'Developers collaborating on a project during an intensive team session',
    sizes: '(max-width: 768px) 50vw, 38vw',
  },
  {
    src: '/gallery/08-office-meeting-room.jpeg',
    alt: 'Weekly planning session to align on the upcoming batch curriculum',
    sizes: '(max-width: 768px) 50vw, 20vw',
  },
  {
    src: '/gallery/10-mentoring-oneonone.jpeg',
    alt: 'One-on-one mentoring session helping a student work through their project',
    sizes: '(max-width: 768px) 50vw, 20vw',
  },
];

export function HomepageGalleryStrip() {
  return (
    <section className="ls-section-alt">
      <div className="ls-container">
        <AnimateOnScroll className="mb-10">
          <h2 className="mb-2">Life at LearnSynaptic</h2>
          <p style={{ color: 'var(--ls-muted)', maxWidth: 460 }}>
            Not a studio shoot. Just what&apos;s actually happening.
          </p>
        </AnimateOnScroll>

        {/*
          Desktop: 3-col grid where col-1 is wider (2fr) — gives the first
          item in each row a naturally larger footprint without row-spanning.
          Mobile: 2-col equal grid.
        */}
        <StaggerContainer className="grid gap-3 grid-cols-2 md:grid-cols-[2fr_1fr_1fr]">
          {photos.map((photo) => (
            <StaggerItem key={photo.src}>
              <div
                className="relative overflow-hidden rounded-xl group"
                style={{ aspectRatio: '4 / 3' }}
              >
                <Image
                  src={photo.src}
                  fill
                  sizes={photo.sizes}
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                  alt={photo.alt}
                />
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <AnimateOnScroll className="mt-8 text-center" delay={0.1}>
          <Link href="/about#gallery" className="ls-btn-outline">
            See more behind the scenes
            <ArrowRight size={15} />
          </Link>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
