import Image from 'next/image';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';

type Photo = {
  src: string;
  alt: string;
  caption: string;
};

type Group = {
  label: string;
  note?: string;
  cols: string; // Tailwind grid-cols class
  photos: Photo[];
};

const groups: Group[] = [
  {
    label: 'Guest Sessions & Industry Talks',
    note: 'College and industry speaking engagements across India',
    cols: 'grid-cols-1 sm:grid-cols-3',
    photos: [
      {
        src: '/gallery/01-faculty-visit-group.jpeg',
        alt: 'Faculty and industry professionals joining a session with the LearnSynaptic team',
        caption: 'Industry guests and faculty joining a session with the team',
      },
      {
        src: '/gallery/02-corporate-expo-2024-poster.jpeg',
        alt: 'LearnSynaptic represented at Corporate Expo 2024',
        caption: 'Corporate Expo 2024 — connecting with industry professionals',
      },
      {
        src: '/gallery/03-corporate-expo-2023-poster.jpeg',
        alt: 'LearnSynaptic at Corporate Expo 2023, the first major industry speaking engagement',
        caption: 'Corporate Expo 2023 — the first major industry speaking event',
      },
    ],
  },
  {
    label: 'Building, Every Day',
    cols: 'grid-cols-2 sm:grid-cols-4',
    photos: [
      {
        src: '/gallery/05-office-team-coding-1.jpeg',
        alt: 'Team members working on code together at the LearnSynaptic office',
        caption: 'The team heads-down on a sprint — this is most of our days',
      },
      {
        src: '/gallery/06-office-desk-row.jpeg',
        alt: 'Row of workstations set up during an intensive development block',
        caption: 'Deep work setup during an intensive development block',
      },
      {
        src: '/gallery/07-office-team-coding-2.jpeg',
        alt: 'Developers pair programming on a full-stack project during a team session',
        caption: 'Pair programming on a full-stack project build',
      },
      {
        src: '/gallery/08-office-meeting-room.jpeg',
        alt: 'Team gathered in the meeting room for a weekly planning session',
        caption: 'Weekly planning session to align on the upcoming batch curriculum',
      },
    ],
  },
  {
    label: 'Teaching & Mentorship',
    cols: 'grid-cols-1 sm:grid-cols-3',
    photos: [
      {
        src: '/gallery/04-felicitation-award.jpeg',
        alt: 'Felicitation ceremony at a college event recognising LearnSynaptic students',
        caption: 'Felicitation at a college event — recognition from students we trained',
      },
      {
        src: '/gallery/09-teaching-lab-session.jpeg',
        alt: 'Pratik walking through a live coding session with students in the lab',
        caption: 'Walking through a live coding session with the batch',
      },
      {
        src: '/gallery/10-mentoring-oneonone.jpeg',
        alt: 'One-on-one post-session mentoring to help a student debug a tricky problem',
        caption: 'Post-session one-on-one — helping debug a tricky edge case',
      },
    ],
  },
];

export function AboutGallery() {
  return (
    <section id="gallery" className="ls-section">
      <div className="ls-container">
        <AnimateOnScroll className="mb-14">
          <h2 className="mb-3">Behind the Scenes</h2>
          <p style={{ color: 'var(--ls-muted)', maxWidth: 480 }}>
            Real photos from real sessions, events, and workdays — nothing staged.
          </p>
        </AnimateOnScroll>

        <div className="space-y-16">
          {groups.map((group, gi) => (
            <div key={group.label}>
              <AnimateOnScroll delay={gi * 0.04} className="mb-6">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--ls-blue-primary)' }}
                  >
                    {group.label}
                  </p>
                  {group.note && (
                    <span className="text-xs" style={{ color: 'var(--ls-muted)' }}>
                      — {group.note}
                    </span>
                  )}
                </div>
                <div
                  className="mt-2 mb-0 h-px"
                  style={{ background: 'var(--ls-border)' }}
                />
              </AnimateOnScroll>

              <StaggerContainer className={`grid gap-5 ${group.cols}`}>
                {group.photos.map((photo) => (
                  <StaggerItem key={photo.src}>
                    <div>
                      <div
                        className="relative overflow-hidden rounded-xl group mb-3"
                        style={{ aspectRatio: '4 / 3' }}
                      >
                        <Image
                          src={photo.src}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 360px"
                          className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                          alt={photo.alt}
                        />
                      </div>
                      <p
                        className="text-xs leading-snug"
                        style={{ color: 'var(--ls-muted)' }}
                      >
                        {photo.caption}
                      </p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
