export interface MastermindSession {
  n: string;
  short: string;
  slot: string;
  title: string;
  blurb: string;
  points: string[];
}

export const sessions: MastermindSession[] = [
  {
    n: "01",
    short: "Build with AI",
    slot: "MODULE 1",
    title: "Build with AI — AI Apps, Websites, SaaS",
    blurb: "Turn an idea into a working app, website or SaaS product by describing it in plain language.",
    points: [
      "How AI app builders turn prompts into working software",
      "Plan a product: users, features and a simple first version",
      "Build and publish a website or app during the session",
      "Add sign-in, data and payments the AI-assisted way",
      "What it takes to go from prototype to a real SaaS",
    ],
  },
  {
    n: "02",
    short: "AI Coding Agents",
    slot: "MODULE 2",
    title: "AI Coding Agents",
    blurb: "Work with AI that writes, edits and debugs code across a whole project — even if you are new to coding.",
    points: [
      "What coding agents are and how they differ from chatbots",
      "Give an agent clear instructions and review what it builds",
      "Fix bugs and add features with agent help",
      "Good habits: version control, small steps, checking the output",
    ],
  },
  {
    n: "03",
    short: "Automate with AI",
    slot: "MODULE 3",
    title: "Automate with AI",
    blurb: "Remove repetitive work by connecting your apps and letting AI handle the steps in between.",
    points: [
      "Spot tasks in your day that are worth automating",
      "Trigger-and-action workflows across your everyday tools",
      "Add AI steps: summarise, classify, draft and reply",
      "Build and test a workflow you can use right away",
    ],
  },
  {
    n: "04",
    short: "AI Automation Agents",
    slot: "MODULE 4",
    title: "AI Automation Agents",
    blurb: "Go beyond fixed workflows: automations that decide the next step and handle varied inputs.",
    points: [
      "Workflows versus agents — when each one fits",
      "Give an automation tools, context and rules",
      "Handle emails, leads and support requests end to end",
      "Keep a human in the loop where it matters",
    ],
  },
  {
    n: "05",
    short: "AI Agents",
    slot: "MODULE 5",
    title: "AI Agents",
    blurb: "Understand and build agents that plan, use tools and complete multi-step tasks for you.",
    points: [
      "How agents plan, use tools and remember context",
      "Design an agent for a task from your own work",
      "Write the instructions and guardrails that shape its behaviour",
      "Test, improve and share your agent",
    ],
  },
  {
    n: "06",
    short: "AI Productivity",
    slot: "MODULE 6",
    title: "AI Productivity",
    blurb: "Use AI as a daily partner for research, writing, planning and decision-making.",
    points: [
      "A prompt framework that works across every AI assistant",
      "Research, summarise and draft in a fraction of the time",
      "Meeting notes, planning and follow-ups on autopilot",
      "Build your personal AI toolkit and routine",
    ],
  },
  {
    n: "07",
    short: "Data Analysis with AI",
    slot: "MODULE 7",
    title: "Data Analysis with AI",
    blurb: "Ask questions of your data in plain language and turn it into charts and insights.",
    points: [
      "Clean and understand a spreadsheet with AI help",
      "Ask questions in plain English and get answers with charts",
      "Spot trends and outliers worth acting on",
      "Present findings in a clear, shareable format",
    ],
  },
];

export const audiences = [
  { t: "Students", d: "Add practical AI skills that make your profile stand out at placements." },
  { t: "Working Professionals", d: "Automate repetitive work and ship AI-assisted output faster." },
  { t: "Founders & Business Owners", d: "Build AI workflows for content, support and operations." },
  { t: "Creators & Marketers", d: "Produce images, ads and videos at a pace that was impossible before." },
  { t: "Career Switchers", d: "A clear, hands-on starting point into the AI world." },
];

export const tools = [
  "ChatGPT", "Claude", "Gemini", "Cursor", "Claude Code", "Lovable",
  "v0", "n8n", "Make", "Perplexity",
];

export const faqs = [
  { q: "What is the 1-Day AI Mastermind?", a: "A live, hands-on one-day program of seven expert-led modules covering building apps and websites with AI, coding agents, automation, AI agents, productivity and data analysis." },
  { q: "When is the next session?", a: "Sessions run on Mondays, Wednesdays, Fridays and Sundays. The next upcoming date is shown at the top of this page." },
  { q: "How much does it cost?", a: "A seat is ₹199." },
  { q: "Do I need a technical background?", a: "No. The program is designed for beginners and working professionals alike — no coding is required." },
  { q: "How do I join?", a: "Tap Register Now, enter your WhatsApp number, and you will receive the details for the session. You can also join the AI Community on WhatsApp for updates." },
];


export interface MastermindReview {
  name: string;
  role: string;
  quote: string;
}

/** Only add REAL, consented learner reviews here. The section stays hidden while this is empty. */
export const reviews: MastermindReview[] = [];

export const heroVideoSrc = "/ai-mastermind/assets/HORIZONTAL.mp4";
export const heroVideoPoster = "/ai-mastermind/assets/hero-poster.jpg";

export const galleryPhotos = [
  { src: "/ai-mastermind/session-2.jpg", alt: "Mentor presenting how AI evolved during a live session", w: 1500, h: 2000, tall: true },
  { src: "/ai-mastermind/session-3.jpg", alt: "Mentor walking through an AI workshop in a packed hall", w: 1500, h: 2000, tall: true },
  { src: "/ai-mastermind/session-1.jpg", alt: "Attentive learners following a live AI session", w: 1500, h: 2000, tall: true },
  { src: "/ai-mastermind/community-1.jpg", alt: "LearnSynaptic community and team group photo", w: 1217, h: 900, tall: false },
  { src: "/ai-mastermind/community-2.webp", alt: "Felicitation of mentors at a college session", w: 1360, h: 907, tall: false },
];

export const pricePoints = [
  "A full day of live, hands-on training",
  "7 expert-led modules with guided exercises",
  "Build an AI-made app, an automation and your own AI agent",
  "Prompt frameworks and templates you can reuse",
  "Join the AI Community to keep learning after the session",
];

/** Path to the sample certificate image, e.g. "/ai-mastermind/certificate.png" (file in public/ai-mastermind/).
 *  The certificate section stays hidden while this is null. */
export const certificateSrc: string | null = "/ai-mastermind/certificate.png";
export const certificatePdf = "/ai-mastermind/certificate.pdf";
export const certificateAlt = "Sample LearnSynaptic Certificate of Completion for the Generative AI Mastermind";

/**
 * PLACEHOLDER reviews so the layout can be reviewed. They are fictional and the page labels them "Sample".
 * They are shown only while `reviews` (real, consented learner reviews) is empty.
 */
export const sampleReviews: MastermindReview[] = [
  { name: "Sample Learner 1", role: "Student", quote: "Sample review text — a short line from a learner about the session goes here." },
  { name: "Sample Learner 2", role: "Working professional", quote: "Sample review text — what they built or automated during the day goes here." },
  { name: "Sample Learner 3", role: "Business owner", quote: "Sample review text — how the session helped their business goes here." },
  { name: "Sample Learner 4", role: "Career switcher", quote: "Sample review text — how clear and hands-on the modules felt goes here." },
  { name: "Sample Learner 5", role: "Creator", quote: "Sample review text — a favourite module or tool they learned goes here." },
  { name: "Sample Learner 6", role: "Student", quote: "Sample review text — whether they would recommend it to a friend goes here." },
];
