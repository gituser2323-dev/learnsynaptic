import type { Metadata } from 'next';
import { CertificateGenerator } from '@/components/CertificateGenerator';

export const metadata: Metadata = {
  alternates: { canonical: '/mastermind-certificate' },
  title: 'Mastermind Certificate Generator',
  description:
    'Generate a LearnSynaptic GenAI Mastermind Certificate of Completion with the student name and program.',
  robots: { index: false, follow: false },
};

export default function MastermindCertificatePage() {
  return (
    <section
      id="main-content"
      className="pt-32 pb-16 lg:pt-40 lg:pb-20"
      style={{ background: 'var(--ls-hero-bg)' }}
    >
      <div className="ls-container">
        <CertificateGenerator
          variant="simple"
          programs={['Generative AI Mastermind', 'GenAI Mastermind']}
        />
      </div>
    </section>
  );
}
