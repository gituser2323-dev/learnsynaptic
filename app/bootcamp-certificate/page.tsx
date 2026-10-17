import type { Metadata } from 'next';
import { CertificateGenerator } from '@/components/CertificateGenerator';

export const metadata: Metadata = {
  alternates: { canonical: '/bootcamp-certificate' },
  title: 'Bootcamp Certificate Generator',
  description:
    'Generate a LearnSynaptic Certificate of Completion with the student name, program, start date and certificate number.',
  robots: { index: false, follow: false },
};

export default function BootcampCertificatePage() {
  return (
    <section
      id="main-content"
      className="pt-32 pb-16 lg:pt-40 lg:pb-20"
      style={{ background: 'var(--ls-hero-bg)' }}
    >
      <div className="ls-container">
        <CertificateGenerator />
      </div>
    </section>
  );
}
