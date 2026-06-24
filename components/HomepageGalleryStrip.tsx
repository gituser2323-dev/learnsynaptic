import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';

type GalleryPhoto = {
  src: string;
  alt: string;
  caption: string;
  objectPosition?: string;
  aspectRatio: string;
};

const openerPhoto: GalleryPhoto = {
  src: '/gallery/18-batch-students-group.jpeg',
  alt: 'The full batch seated together — real people, real commitment',
  caption: 'A full batch — real people, real commitment',
  objectPosition: 'center 30%',
  aspectRatio: '16/9',
};

const masonryPhotos: GalleryPhoto[] = [
  // Classroom / teaching
  
  // Office / team
  {
    src: '/gallery/20-founder-portrait.jpeg',
    alt: 'LearnSynaptic team members working at their desks',
    caption: 'The team at work',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  
  // Guest session / industry
  {
    src: '/gallery/13-mmit-expert-session-audience.jpeg',
    alt: 'Packed hall during an industry expert session',
    caption: 'Industry session — packed hall',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  
  // Classroom / teaching
  {
    src: '/gallery/09-teaching-lab-session.jpeg',
    alt: 'Hands-on lab session — walking through a live project build',
    caption: 'Hands-on lab session',
    objectPosition: 'center 20%',
    aspectRatio: '3/4',
  },
  {
    src: '/gallery/26.jpeg',
    alt: 'Guest lecture In Pune',
    caption: 'Live Sessions',
    objectPosition: 'center center',
    aspectRatio: '1/1',
  },
  
   {
    src: '/gallery/25.jpeg',
    alt: 'Guest lecture',
    caption: 'Sessions',
    objectPosition: 'center center',
    aspectRatio: '16/10',
  },
  // Guest session / industry
  {
    src: '/gallery/15-mmit-handshake-moment.jpeg',
    alt: 'Partnership handshake moment.',
    caption: 'Partnering, Pune',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  // Classroom / teaching
  {
    src: '/gallery/21-candid-walking-laptop.jpeg',
    alt: 'Live teaching session with board and projector screen visible',
    caption: 'Live session — full engagement',
    objectPosition: 'center center',
    aspectRatio: '1/1',
  },
   {
    src: '/gallery/10-mentoring-oneonone.jpeg',
    alt: 'One-on-one mentoring after class',
    caption: 'One-on-one mentoring, after class',
    objectPosition: 'center top',
    aspectRatio: '3/4',
  },
  // Office / team
  {
    src: '/gallery/12-office-small-team.jpg',
    alt: 'Small team gathered at the LearnSynaptic office',
    caption: 'Building LearnSynaptic, together',
    objectPosition: 'center center',
    aspectRatio: '1/1',
  },
  // Guest session / industry
  {
    src: '/gallery/27.jpeg',
    alt: 'Guest lecture',
    caption: 'Live Expert Sessions',
    objectPosition: 'center center',
    aspectRatio: '16/9',
  },
  {
    src: '/gallery/14-mmit-expert-session-teaching.jpeg',
    alt: 'Pratik mid-session — walking through a concept live',
    caption: 'Expert session at Pune',
    objectPosition: 'center 15%',
    aspectRatio: '4/3',
  },

  

  
 
];

export function HomepageGalleryStrip() {
  return (
    <section className="ls-section-alt">
      <div className="ls-container">

        <AnimateOnScroll className="mb-10">
          <h2 className="mb-2">Life at LearnSynaptic</h2>
          <p style={{ color: 'var(--ls-muted)', maxWidth: 540 }}>
            Not staged. Just what&apos;s actually happening — in classrooms,
            in our office, and on stage.
          </p>
        </AnimateOnScroll>

        {/* Full-width opener — strongest single image */}
        <AnimateOnScroll className="mb-4">
          <div
            className="relative overflow-hidden rounded-2xl w-full group"
            style={{ aspectRatio: openerPhoto.aspectRatio }}
          >
            <Image
              src={openerPhoto.src}
              fill
              sizes="100vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              style={{ objectPosition: openerPhoto.objectPosition }}
              alt={openerPhoto.alt}
              priority={false}
            />
            <div className="ls-caption-overlay" />
            <p className="ls-caption-text">{openerPhoto.caption}</p>
          </div>
        </AnimateOnScroll>

        {/* Masonry grid — same technique as About page */}
        <AnimateOnScroll delay={0.06}>
          <div className="ls-gallery-masonry">
            {masonryPhotos.map((photo) => (
              <div
                key={photo.src}
                className="ls-gallery-brick group"
                style={{ aspectRatio: photo.aspectRatio }}
              >
                <Image
                  src={photo.src}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  style={{ objectPosition: photo.objectPosition ?? 'center center' }}
                  alt={photo.alt}
                />
                <div className="ls-caption-overlay" />
                <p className="ls-caption-text">{photo.caption}</p>
              </div>
            ))}
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll className="mt-8" delay={0.12}>
          <Link href="/about#gallery" className="ls-btn-outline">
            See the full story
            <ArrowRight size={15} />
          </Link>
        </AnimateOnScroll>

      </div>
    </section>
  );
}
