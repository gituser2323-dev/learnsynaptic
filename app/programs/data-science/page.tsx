import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Clock, Calendar, Users, CheckCircle2, TrendingUp, Quote,
} from 'lucide-react';
import { AnimateOnScroll, StaggerContainer, StaggerItem } from '@/components/ui/AnimateOnScroll';
import { CurriculumAccordion } from '@/components/CurriculumAccordion';
import { ProgramFAQ } from '@/components/ProgramFAQ';

export const metadata: Metadata = {
  alternates: { canonical: '/programs/data-science' },
  title: 'Data Science AI/ML Specialisation — 5 Months | LearnSynaptic',
  description:
    'Master Python, machine learning, deep learning, NLP, and Power BI in 5 months. Pune-based Data Science program with 85% placement rate across India.',
  keywords: ['data science course India', 'machine learning training Pune', 'AI ML course India', 'data analyst course'],
};

const curriculum = [
  {
    title: 'Python for Data Science — Pandas, NumPy & Data Wrangling',
    duration: '3 weeks',
    description: 'Build the Python foundation every Data Scientist needs. We go well beyond basics — this module teaches you to handle messy, real-world data at scale.',
    topics: [
      'NumPy arrays, broadcasting, and vectorised operations',
      'Pandas DataFrames: indexing, groupby, merge, pivot',
      'Data cleaning: handling nulls, duplicates, outliers',
      'Working with real datasets (CSV, JSON, Excel, APIs)',
      'Performance optimisation for large datasets',
    ],
  },
  {
    title: 'Data Visualisation — Matplotlib, Seaborn & Power BI',
    duration: '2 weeks',
    description: 'Data that cannot be communicated is data that does not matter. Learn to build visualisations that make patterns obvious and dashboards that stakeholders actually use.',
    topics: [
      'Matplotlib: figure architecture, subplots, custom styles',
      'Seaborn: statistical plots, heatmaps, pair plots',
      'Plotly for interactive charts in notebooks',
      'Power BI: data modelling, DAX basics, report building',
      'Storytelling with data: choosing the right chart for the message',
    ],
  },
  {
    title: 'Statistics & Probability for Data Science',
    duration: '2 weeks',
    description: 'The maths that underpins every machine learning algorithm — taught practically, not theoretically. You will understand why models work, not just how to run them.',
    topics: [
      'Descriptive statistics: mean, median, variance, skew',
      'Probability distributions: normal, binomial, Poisson',
      'Hypothesis testing: t-test, chi-square, ANOVA',
      'Correlation, covariance, and causation (the critical difference)',
      'A/B testing design and interpretation',
    ],
  },
  {
    title: 'Machine Learning — Supervised & Unsupervised',
    duration: '4 weeks',
    description: 'The core of the program. You will implement and genuinely understand the most important ML algorithms — from linear regression to gradient boosting — by applying them to real datasets.',
    topics: [
      'Linear & logistic regression from first principles',
      'Decision trees, random forests, and XGBoost',
      'Support vector machines and KNN',
      'Unsupervised: K-means, DBSCAN, hierarchical clustering',
      'Model evaluation: cross-validation, precision/recall, ROC-AUC',
      'Feature engineering and selection techniques',
    ],
  },
  {
    title: 'Deep Learning — Neural Networks, CNNs & Transfer Learning',
    duration: '3 weeks',
    description: 'Build, train, and evaluate neural networks using TensorFlow and Keras. We focus on practical deep learning — image classification, transfer learning, and model deployment.',
    topics: [
      'Neural network architecture: layers, activations, backpropagation',
      'Building and training models in Keras',
      'Convolutional Neural Networks for image classification',
      'Transfer learning with pretrained models (ResNet, VGG)',
      'Avoiding overfitting: dropout, regularisation, augmentation',
    ],
  },
  {
    title: 'Natural Language Processing (NLP)',
    duration: '2 weeks',
    description: 'Text data is everywhere — customer reviews, support tickets, social media. This module teaches you to extract meaning from text using both classical and transformer-based approaches.',
    topics: [
      'Text preprocessing: tokenisation, stemming, lemmatisation',
      'TF-IDF and word embeddings (Word2Vec, GloVe)',
      'Sentiment analysis with Scikit-learn and VADER',
      'Named entity recognition (NER)',
      'Using pretrained transformers (BERT, DistilBERT) via HuggingFace',
    ],
  },
  {
    title: 'SQL for Data Science',
    duration: '2 weeks',
    description: 'SQL is the universal language of data. Every data role requires it. This module goes beyond SELECT * — we cover window functions, CTEs, and real analytical SQL patterns.',
    topics: [
      'Advanced joins: LEFT, RIGHT, FULL OUTER, SELF joins',
      'Window functions: ROW_NUMBER, RANK, LEAD, LAG, NTILE',
      'Common Table Expressions (CTEs) and recursive queries',
      'SQL for analytics: cohort analysis, funnel queries',
      'Connecting Python (Pandas) to SQL databases',
    ],
  },
  {
    title: 'Capstone Project — End-to-End Data Science Pipeline',
    duration: '2 weeks',
    description: 'Build a complete, documented data science project that you own. From problem framing to EDA, model building, dashboard, and final presentation to a mock stakeholder panel.',
    topics: [
      'Defining a data science problem brief (with mentor review)',
      'Exploratory data analysis (EDA) report',
      'Feature engineering + ML model pipeline',
      'Power BI dashboard linked to your model outputs',
      'Final presentation to a mock stakeholder panel',
    ],
  },
];

const tools = [
  { name: 'Python 3', cat: 'Core' },
  { name: 'Jupyter Notebook', cat: 'Core' },
  { name: 'Google Colab', cat: 'Core' },
  { name: 'Pandas', cat: 'Data Wrangling' },
  { name: 'NumPy', cat: 'Data Wrangling' },
  { name: 'Matplotlib', cat: 'Visualisation' },
  { name: 'Seaborn', cat: 'Visualisation' },
  { name: 'Power BI', cat: 'Visualisation' },
  { name: 'Scikit-learn', cat: 'Machine Learning' },
  { name: 'XGBoost', cat: 'Machine Learning' },
  { name: 'TensorFlow', cat: 'Deep Learning' },
  { name: 'Keras', cat: 'Deep Learning' },
  { name: 'Hugging Face', cat: 'NLP' },
  { name: 'NLTK', cat: 'NLP' },
  { name: 'PostgreSQL', cat: 'SQL' },
  { name: 'SQLite', cat: 'SQL' },
];

const projects = [
  {
    num: '01',
    title: 'Predictive ML Model — Real Business Dataset',
    stack: 'Pandas, Scikit-learn, XGBoost',
    description: 'An end-to-end ML pipeline predicting a real business outcome (churn, fraud, price) with 90%+ accuracy. Full EDA, feature engineering, model tuning, and evaluation report included.',
  },
  {
    num: '02',
    title: 'Power BI Dashboard from Raw Data',
    stack: 'Power BI, DAX, Python',
    description: 'A fully interactive sales / operations dashboard built from a raw CSV dataset. Includes calculated columns, KPI cards, drill-through pages, and stakeholder-ready storytelling.',
  },
  {
    num: '03',
    title: 'NLP Sentiment Analysis Pipeline',
    stack: 'BERT, HuggingFace, Streamlit',
    description: 'A production-ready sentiment analysis system for customer reviews. Uses a fine-tuned BERT model and presents results through a Streamlit dashboard with filtering and export.',
  },
];

const testimonials = [
  {
    name: 'Priya Sharma',
    role: 'BPO Executive → Data Analyst at Deloitte',
    quote: 'The Data Science program gave me both the technical skills and the language to talk about data in a way that business stakeholders understand. The Power BI module and the SQL module were directly tested in my Deloitte interview.',
    badge: '2.5× Salary Hike',
    initials: 'PS',
  },
  {
    name: 'Karan Mehta',
    role: 'Mechanical Engineer → ML Engineer at Fractal Analytics',
    quote: 'Career switch from a non-IT background felt impossible until this program. The statistics module finally made ML algorithms make sense — not as black boxes, but as mathematical tools I could reason about.',
    badge: '₹10.5 LPA Package',
    initials: 'KM',
  },
];

const faqs = [
  {
    question: 'Do I need a mathematics background to succeed in this program?',
    answer: 'No A-level maths required. You need to be comfortable with basic arithmetic and be willing to engage with concepts like averages and percentages. The statistics module teaches everything you need from scratch using Python — no pen-and-paper derivations.',
  },
  {
    question: 'How does this program compare to online platforms like Coursera or Analytics Vidhya?',
    answer: 'Self-paced platforms give you knowledge. We give you accountability, real feedback on your code and projects, mentor office hours, and placement support. Our capstone is reviewed by an industry practitioner. The completion rate on self-paced courses is under 10%; ours is over 90%.',
  },
  {
    question: 'What roles can I target after completing this program?',
    answer: 'Data Analyst, Business Analyst, ML Engineer (junior), Data Science Associate, and AI Research Engineer. Our placement team matches you to the specific role that aligns with your background and the skills you have built.',
  },
  {
    question: 'Is SQL covered in depth?',
    answer: 'Yes — a dedicated 2-week SQL module covering window functions, CTEs, and analytical SQL patterns. SQL is tested in every data interview; we treat it as a core skill, not an afterthought.',
  },
  {
    question: 'Do you cover deep learning and AI in addition to classical ML?',
    answer: 'Yes. The curriculum spans classical ML (Scikit-learn), deep learning (TensorFlow/Keras with CNNs and transfer learning), and NLP with pretrained transformers (BERT via HuggingFace). This is a full-spectrum data science program, not just a beginner ML course.',
  },
  {
    question: 'What is the weekend batch schedule?',
    answer: 'Weekend batches run Saturday and Sunday, 10 AM to 6 PM IST, with a lunch break. This is a full 8-hour day — it is an intensive format but allows working professionals to complete the program without taking leave from their current job.',
  },
  {
    question: 'Can I get a job at a product company, not just service firms?',
    answer: 'Yes — our hiring partners include both service firms (Wipro, TCS, Infosys, Deloitte, Cognizant) and analytics-focused product companies. Your capstone project and GitHub profile are what open product company doors; our placement team helps you position them correctly.',
  },
];

const batches = [
  { date: 'July 21, 2026', type: 'Weekday Batch', time: 'Mon–Fri, 7–11 PM IST', seats: 6 },
  { date: 'September 1, 2026', type: 'Weekend Batch', time: 'Sat–Sun, 10 AM–6 PM IST', seats: 14 },
  { date: 'October 20, 2026', type: 'Weekday Batch', time: 'Mon–Fri, 7–11 PM IST', seats: 20 },
];

export default function DataSciencePage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 lg:pt-40 lg:pb-20" style={{ background: 'var(--ls-hero-bg)' }}>
        <div className="ls-container">
          <AnimateOnScroll>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="ls-badge"><Clock size={12} /> 5 Months</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#dcfce7', color: '#166534' }}>
                85% Placement Rate
              </span>
            </div>
            <h1 className="mb-4" style={{ maxWidth: 800 }}>Data Science — AI/ML Specialisation</h1>
            <p className="text-xl mb-6" style={{ color: 'var(--ls-muted)', maxWidth: 620, lineHeight: 1.65 }}>
              The complete data science stack — from Python and SQL to machine learning, deep learning, and NLP.
              Build a portfolio that lands analyst and ML engineer roles at analytics-driven companies.
            </p>
            <div className="flex flex-wrap gap-6 mb-8">
              {[
                { label: 'Duration', value: '5 Months', Icon: Clock },
                { label: 'Next Batch', value: 'Jul 21, 2026', Icon: Calendar },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={15} style={{ color: 'var(--ls-blue-primary)' }} />
                  <span className="text-sm" style={{ color: 'var(--ls-muted)' }}>{label}: </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--ls-text)' }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/contact" className="ls-btn-primary">Apply for This Program <ArrowRight size={16} /></Link>
              <Link href="#curriculum" className="ls-btn-outline">View Curriculum</Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Overview (asymmetric) ─────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <AnimateOnScroll>
                <h2 className="mb-4">A data science program built for career switchers</h2>
                <div className="space-y-4 text-base" style={{ color: 'var(--ls-muted)', maxWidth: 640 }}>
                  <p>
                    Most people joining this program are not CS graduates. They are mechanical engineers, BPO
                    professionals, commerce graduates, and science majors who see data science as their path
                    into tech. This program is designed with that starting point in mind.
                  </p>
                  <p>
                    The statistics module is taught visually and practically — no proofs, no derivations. The
                    ML module explains why algorithms work before showing you how to run them. By graduation,
                    you have an EDA report, a working ML pipeline, a Power BI dashboard, and an NLP project
                    — exactly the portfolio that data analyst and ML engineer hiring teams look for.
                  </p>
                </div>
              </AnimateOnScroll>
            </div>
            <AnimateOnScroll delay={0.1} className="lg:col-span-1">
              <div className="rounded-2xl border p-6 sticky top-28" style={{ borderColor: 'var(--ls-border)', background: 'var(--ls-bg-alt)' }}>
                <h3 className="mb-5" style={{ fontSize: '1rem', fontWeight: 700 }}>Program at a glance</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Duration', value: '5 Months' },
                    { label: 'Batch size', value: 'Max 30 students' },
                    { label: 'Format', value: 'Live + Recorded' },
                    { label: 'Projects', value: '3 portfolio projects' },
                    { label: 'Level', value: 'Beginner–Intermediate' },
                    { label: 'Job support', value: '6 months post-program' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--ls-muted)' }}>{label}</span>
                      <span className="font-semibold" style={{ color: 'var(--ls-text)' }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--ls-border)' }}>
                  <Link href="/contact" className="ls-btn-primary w-full justify-center text-sm">
                    Book a Demo
                  </Link>
                  <p className="text-xs mt-3 text-center" style={{ color: 'var(--ls-muted)' }}>
                    Free 30-min call — pricing discussed on call.
                  </p>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* ── Projects ─────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10">
            <h2 className="mb-3">3 Portfolio Projects That Get You Hired</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              Each project is built on a real dataset, reviewed by an industry mentor, and documented for GitHub and LinkedIn.
            </p>
          </AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <StaggerItem key={proj.num}>
                <div className="bg-white rounded-2xl border p-6 h-full" style={{ borderColor: 'var(--ls-border)' }}>
                  <span className="text-4xl font-black block mb-3" style={{ color: 'var(--ls-blue-tint)', lineHeight: 1 }}>{proj.num}</span>
                  <h3 className="mb-2" style={{ fontSize: '1rem', fontWeight: 700 }}>{proj.title}</h3>
                  <p className="text-xs font-medium mb-3 px-2 py-1 rounded-md inline-block" style={{ background: 'var(--ls-blue-tint)', color: 'var(--ls-blue-primary)' }}>{proj.stack}</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ls-muted)' }}>{proj.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── Curriculum ──────────────────────────────────────────────────── */}
      <section id="curriculum" className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8">
            <h2 className="mb-3">Full Curriculum — 8 Modules</h2>
            <p style={{ color: 'var(--ls-muted)', maxWidth: 520 }}>
              20 weeks covering the complete data science stack, from Python to deep learning and SQL.
            </p>
          </AnimateOnScroll>
          <AnimateOnScroll><CurriculumAccordion modules={curriculum} /></AnimateOnScroll>
        </div>
      </section>

      {/* ── Tools ────────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8"><h2 className="mb-3">Tools & Technologies</h2></AnimateOnScroll>
          {['Core', 'Data Wrangling', 'Visualisation', 'Machine Learning', 'Deep Learning', 'NLP', 'SQL'].map((cat) => (
            <AnimateOnScroll key={cat} className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ls-muted)' }}>{cat}</p>
              <div className="flex flex-wrap gap-2">
                {tools.filter((t) => t.cat === cat).map((t) => (
                  <span key={t.name} className="text-sm font-medium px-3.5 py-2 rounded-xl border bg-white" style={{ borderColor: 'var(--ls-border)', color: 'var(--ls-text)' }}>{t.name}</span>
                ))}
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </section>

      {/* ── Batch Dates ──────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8"><h2 className="mb-3">Upcoming Batches</h2></AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {batches.map((b) => (
              <StaggerItem key={b.date}>
                <div className="rounded-2xl border p-5" style={{ borderColor: b.seats <= 8 ? 'var(--ls-blue-primary)' : 'var(--ls-border)', background: b.seats <= 8 ? 'var(--ls-blue-tint)' : 'white' }}>
                  {b.seats <= 8 && <span className="text-xs font-semibold mb-2 inline-block" style={{ color: 'var(--ls-blue-primary)' }}>FILLING FAST</span>}
                  <p className="font-bold text-lg mb-1" style={{ color: 'var(--ls-text)' }}>{b.date}</p>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ls-text)' }}>{b.type}</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--ls-muted)' }}>{b.time}</p>
                  <p className="text-xs font-medium" style={{ color: b.seats <= 8 ? '#dc2626' : 'var(--ls-muted)' }}>{b.seats} seats remaining</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── What's Included ──────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <AnimateOnScroll className="mb-8"><h2 className="mb-3">What&apos;s Included</h2></AnimateOnScroll>
          <AnimateOnScroll>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border p-8 bg-white" style={{ borderColor: 'var(--ls-border)' }}>
                <h3 className="mb-5" style={{ fontSize: '1rem', fontWeight: 700 }}>Everything in this program</h3>
                <ul className="space-y-3 mb-6">
                  {[
                    '280+ hours of live instruction',
                    '3 portfolio projects with mentor review',
                    'Dedicated placement support (6 months)',
                    '1-year access to all recorded sessions',
                    'Power BI licence guidance',
                    'LearnSynaptic completion certificate',
                    'Alumni Slack community access',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ls-success)' }} />
                      <span style={{ color: 'var(--ls-text)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/contact" className="ls-btn-primary w-full justify-center">Get Program Details <ArrowRight size={15} /></Link>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border p-6 bg-white" style={{ borderColor: 'var(--ls-border)' }}>
                  <h3 className="mb-4" style={{ fontSize: '1rem', fontWeight: 700 }}>Payment options</h3>
                  <div className="space-y-4">
                    {[
                      { label: '0% interest EMI', note: 'Equal monthly installments via Razorpay — no processing fee' },
                      { label: 'No hidden charges', note: 'Fee covers all sessions, recordings, project reviews, and placement support' },
                      { label: 'Refund policy', note: 'Full refund within 7 days of batch start, pro-rated after that' },
                    ].map(({ label, note }) => (
                      <div key={label} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ls-success)' }} />
                        <div>
                          <p style={{ color: 'var(--ls-text)', fontWeight: 500 }}>{label}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--ls-muted)' }}>{note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl p-5" style={{ background: 'var(--ls-blue-tint)', border: '1px solid var(--ls-blue-primary)' }}>
                  <p className="font-semibold text-sm mb-2" style={{ color: 'var(--ls-text)' }}>
                    Talk to us about pricing
                  </p>
                  <p className="text-sm mb-4" style={{ color: 'var(--ls-muted)' }}>
                    Fees and EMI options are discussed on a free 30-minute call. Cost should not be the only thing stopping a serious candidate from starting.
                  </p>
                  <Link href="/contact" className="text-sm font-semibold" style={{ color: 'var(--ls-blue-primary)' }}>
                    Book a free call →
                  </Link>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-container">
          <AnimateOnScroll className="mb-10"><h2 className="mb-3">From our Data Science graduates</h2></AnimateOnScroll>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <div className="bg-white rounded-2xl border p-6 h-full flex flex-col" style={{ borderColor: 'var(--ls-border)' }}>
                  <Quote size={20} className="mb-4" style={{ color: 'var(--ls-blue-tint)' }} />
                  <p className="text-sm leading-relaxed flex-1 mb-5" style={{ color: 'var(--ls-text)' }}>&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--ls-border)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'var(--ls-blue-primary)' }}>{t.initials}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--ls-text)' }}>{t.name}</p>
                      <p className="text-xs" style={{ color: 'var(--ls-muted)' }}>{t.role}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ background: '#dcfce7', color: 'var(--ls-success)' }}>{t.badge}</span>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* ── FAQs ─────────────────────────────────────────────────────────── */}
      <section className="ls-section-alt">
        <div className="ls-container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <AnimateOnScroll className="lg:col-span-1">
              <h2 className="mb-4">Frequently asked questions</h2>
              <p style={{ color: 'var(--ls-muted)' }}>Questions? Our team replies within 2 hours on weekdays.</p>
              <Link href="/contact" className="ls-btn-outline mt-6 inline-flex">Ask a question <ArrowRight size={14} /></Link>
            </AnimateOnScroll>
            <AnimateOnScroll className="lg:col-span-2" delay={0.1}>
              <ProgramFAQ faqs={faqs} />
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--ls-blue-primary)', padding: '96px 0' }}>
        <div className="ls-container text-center">
          <AnimateOnScroll>
            <h2 className="mb-4" style={{ color: '#fff', maxWidth: 620, margin: '0 auto 1rem' }}>
              Join the July 21 batch — your data career starts here.
            </h2>
            <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 480, margin: '0 auto 2rem' }}>
              5 months of structured learning that gives you the portfolio and the language to walk into any data interview.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/contact" className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:-translate-y-0.5 transition-transform" style={{ color: 'var(--ls-blue-primary)', fontSize: '0.9375rem' }}>
                Apply for July Batch <ArrowRight size={16} />
              </Link>
              <Link href="/programs" className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl border-2 hover:-translate-y-0.5 transition-transform" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', fontSize: '0.9375rem' }}>
                Compare All Programs
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
