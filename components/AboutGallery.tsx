import Image from 'next/image';
import { AnimateOnScroll } from '@/components/ui/AnimateOnScroll';

type Photo = {
  src: string;
  alt: string;
  caption: string;
  objectPosition?: string;
  aspectRatio: string;
};

/* ── Full-width opener ─────────────────────────────────────────────────────── */

const openerPhoto: Photo = {
  src: '/gallery/18-batch-students-group.jpeg',
  alt: 'The full batch seated together — real people, real commitment',
  caption: 'A full batch — real people, real commitment',
  objectPosition: 'center 30%',
  aspectRatio: '14/9',
};

/* ── Masonry grid — all photos shuffled, no thematic grouping ──────────────── */
/* Varied aspect ratios (3:4, 4:3, 16:9, 1:1) drive natural height variety    */

const masonryPhotos: Photo[] = [
  {
    src: '/gallery/14-mmit-expert-session-teaching.jpeg',
    alt: 'Pratik mid-session at MMIT, Lohgaon — walking through a concept live',
    caption: 'Expert session at MMIT, Lohgaon',
    objectPosition: 'center 15%',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/20-founder-portrait.jpeg',
    alt: 'Pratik Sabale — Founder of LearnSynaptic',
    caption: 'Pratik Sabale — Founder, LearnSynaptic',
    objectPosition: 'center top',
    aspectRatio: '3/4',
  },
  {
    src: '/gallery/13-mmit-expert-session-audience.jpeg',
    alt: 'The audience at the MMIT expert session — students and faculty filling the room',
    caption: 'Expert Session at MMIT, Lohgaon',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/05-office-team-coding-1.jpeg',
    alt: 'The team heads-down on code at the LearnSynaptic office',
    caption: 'Most of our afternoons look like this',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/16-mmit-mou-signing.jpeg',
    alt: 'Signing the MOU with MMIT, Pune',
    caption: 'Signing our MOU with MMIT',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/09-teaching-lab-session.jpeg',
    alt: 'Hands-on lab session — walking through a live project build',
    caption: 'Hands-on lab session',
    objectPosition: 'center 20%',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/23-ahmednagar-college-guest-lecture.jpeg',
    alt: 'Guest lecture at Shri Chhatrapati Shivaji Maharaj College of Engineering, Ahmednagar',
    caption: 'Guest lecture at SCSMC Engineering, Ahmednagar',
    objectPosition: 'center center',
    aspectRatio: '16/9',
  },
  {
    src: '/gallery/19-desk-personality-shot.jpeg',
    alt: 'A laptop, a snack jar, and something to build — the real essentials',
    caption: 'The essentials',
    objectPosition: 'center center',
    aspectRatio: '1/1',
  },

    {
    src: '/gallery/24.jpeg',
    alt: 'Guest lecture',
    caption: 'Live Sessions',
    objectPosition: 'center center',
    aspectRatio: '1/1',
  },
  {
    src: '/gallery/15-mmit-handshake-moment.jpeg',
    alt: 'Handshake moment with MMIT faculty — the start of a formal partnership',
    caption: 'Post-session with MMIT faculty',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/07-office-team-coding-2.jpeg',
    alt: 'Pair programming on a full-stack project',
    caption: 'Pair-programming on a full-stack build',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/17-mou-group-handover.jpeg',
    alt: 'Group photo after Session — faculty and the LearnSynaptic team',
    caption: 'faculty and the LearnSynaptic team',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
 
  {
    src: '/gallery/22-teaching-board-screen.jpeg',
    alt: 'Teaching with the board and screen — concepts that need more than slides',
    caption: 'Concepts that need a whiteboard',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/11-classroom-space.webp',
    alt: 'The classroom space between sessions — set up and ready for the next batch',
    caption: 'The classroom, between sessions',
    objectPosition: 'center center',
    aspectRatio: '16/9',
  },
  {
    src: '/gallery/08-office-meeting-room.jpeg',
    alt: 'Weekly planning session in the meeting room',
    caption: 'Weekly planning — aligning on the next batch',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/01-faculty-visit-group.jpeg',
    alt: 'Faculty and industry guests joining a session with the LearnSynaptic team',
    caption: 'Faculty and industry guests joining a session',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/21-candid-walking-laptop.jpeg',
    alt: 'Candid between sessions — laptop in hand, always something to build',
    caption: 'Between sessions — always something to build',
    objectPosition: 'center center',
    aspectRatio: '3/4',
  },
  {
    src: '/gallery/12-office-small-team.jpg',
    alt: 'A small group working through a problem together at the office',
    caption: 'Small team, focused problem',
    objectPosition: 'center center',
    aspectRatio: '4/3',
  },
  {
    src: '/gallery/06-office-desk-row.jpeg',
    alt: 'A row of workstations during a focused development block',
    caption: 'Deep work in progress',
    objectPosition: 'center center',
    aspectRatio: '16/9',
  },
  {
    src: '/gallery/04-felicitation-award.jpeg',
    alt: 'Felicitation ceremony — recognition from students trained at LearnSynaptic',
    caption: "Felicitation — recognition from students we've trained",
    objectPosition: 'center center',
    aspectRatio: '3/4',
  },
];

/* ── Main component ────────────────────────────────────────────────────────── */

export function AboutGallery() {
  return (
    <section id="gallery" className="ls-section">
      <div className="ls-container">

        {/* Section header — no sub-grouping below this */}
        <AnimateOnScroll className="mb-12">
          <h2 className="mb-3">Behind the Scenes</h2>
          <p style={{ color: 'var(--ls-muted)', maxWidth: 500 }}>
            Real photos from real sessions, partnerships, and workdays — nothing staged.
          </p>
        </AnimateOnScroll>

        {/* Full-width cinematic opener */}
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

        {/*
          Masonry grid — CSS columns layout.
          Image heights vary naturally from their aspect-ratio, creating an
          organic editorial feel without forced uniform boxes. Captions fade
          in on hover only, keeping the default view clean and photo-focused.
        */}
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

      </div>
    </section>
  );
}
