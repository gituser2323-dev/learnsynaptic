import type { Metadata } from 'next';
import { RegisterForm } from '@/components/RegisterForm';

export const metadata: Metadata = {
  alternates: { canonical: '/register' },
  title: 'Apply to LearnSynaptic — AI & Tech Career Programs',
  description:
    'Tell us where you want to be in 12 months. LearnSynaptic maps out the path — AI, Full Stack Dev, Data Science, and GenAI programs. Pune-based · Pan-India intake.',
  openGraph: {
    title: 'Apply to LearnSynaptic — Start Your AI Career',
    description:
      "Tell us where you want to be. We'll show you the path. Apply for AI, Full Stack Dev, Data Science, or GenAI programs — next cohort July 2025.",
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
