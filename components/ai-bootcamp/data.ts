import type { LucideIcon } from "lucide-react";
import {
  GraduationCap,
  TrendingUp,
  Terminal,
  Briefcase,
  MessageCircle,
  FileText,
  FileSearch,
  Image as ImageIcon,
  Mic,
  Bot,
  Workflow,
  Layers,
  Video,
  UserCheck,
  Wrench,
  BookOpen,
  Users,
  Laptop,
  Code2,
} from "lucide-react";

export interface AwarenessItem {
  icon: LucideIcon;
  headline: string;
  description: string;
}

export const awarenessList: AwarenessItem[] = [
  {
    icon: Laptop,
    headline: "You only know ChatGPT?",
    description: "You use AI tools, but don’t understand how modern AI applications are actually built.",
  },
  {
    icon: Code2,
    headline: "Confused About Which AI Tool to Use?",
    description: "You want AI skills that help you grow your career or business.",
  },
  {
    icon: TrendingUp,
    headline: "Not Sure Where to Start?",
    description: "Companies are hiring developers who can build with AI—not just write code.",
  },
];

export interface AudienceItem {
  label: string;
  icon: LucideIcon;
  headline: string;
  description: string;
  outcome: string;
}

export const audiencesList: AudienceItem[] = [
  {
    label: "Still in college?",
    icon: GraduationCap,
    headline: "Students",
    description:
      "Worried your degree alone won’t be enough at placements? Ship real AI applications instead of one more theory course.",
    outcome: "Graduate with an AI skills",
  },
  {
    label: "Run a business?",
    icon: TrendingUp,
    headline: "Business Owners",
    description:
      "Use AI to automate operations, generate content faster, improve customer support, and scale your business with smarter workflows.",
    outcome: "Skills that compound your value",
  },
  {
    label: "Already a developer?",
    icon: Terminal,
    headline: "Working Professionals",
    description:
      "Automate repetitive work, build AI-powered solutions, boost productivity, and stay ahead in an AI-driven workplace.",
    outcome: "Production-ready AI skills",
  },
  {
    label: "Still worried about careers?",
    icon: Briefcase,
    headline: "Career Explorers",
    description:
      "Curious about AI? Whether you're starting from scratch or exploring a new direction, build practical AI skills through real projects and live mentorship.",
    outcome: "A clear place to start",
  },
];

export const problemsList = [
  { text: "Bookmarked tutorials, never finished" },
  { text: "Copy-pasted prompts, no understanding" },
  { text: "A different tool every week" },
  { text: "Zero projects to show for it" },
  { text: "Nothing for your portfolio" },
  { text: "No idea how real teams work" },
];

export const solutionsList = [
  { text: "Live, working code every session" },
  { text: "Seven real projects, shipped" },
  { text: "Built around AI from day one" },
  { text: "The workflow real teams use" },
  { text: "A portfolio, not a certificate" },
  { text: "Built for your next role" },
];

export interface ProjectItem {
  title: string;
  icon: LucideIcon;
}

export const projectsList: ProjectItem[] = [
  { title: "Your Own AI Chatbot", icon: MessageCircle },
  { title: "Resume Analyzer", icon: FileText },
  { title: "PDF Chat Assistant", icon: FileSearch },
  { title: "Image Analyzer", icon: ImageIcon },
  { title: "Voice AI Receptionist", icon: Mic },
  { title: "Your Own AI Agent", icon: Bot },
  { title: "AI Automation Workflow", icon: Workflow },
  { title: "A Complete AI SaaS", icon: Layers },
];

export interface DayItem {
  day: number;
  label: string;
  problem: string;
  solution: string;
  tech: string;
  project: string;
}

export const daysData: DayItem[] = [
  {
    day: 1,
    label: "Day 01",
    problem:
      "Everyone can open ChatGPT. That's not a skill companies pay for anymore — the way you build with AI is. Today you'll see exactly why 'Traditional Developer' is becoming 'AI Engineer', and why the companies hiring in 2026 aren't looking for AI users.",
    solution:
      "Get the wake-up call first: why AI is rewriting every industry, the shift from AI User to AI Builder, and the AI Engineering mindset. Then go hands-on — AI vs ML vs Generative AI, how LLMs actually think, tokens, context windows, and real prompt engineering across ChatGPT, Claude, Gemini and Cursor.",
    tech: "AI vs ML vs Generative AI, How LLMs Work, Tokens & Context Window, Prompt Engineering, ChatGPT, Claude, Gemini, Cursor, AI Development Workflow",
    project: "our First AI App",
  },
  {
    day: 2,
    label: "Day 02",
    problem:
      "Writing every line by hand is how you fall behind. AI engineers aren't typing faster — they're building differently, with AI as a teammate instead of a search bar.",
    solution:
      "Learn the real AI-assisted development workflow: Cursor mastery, AI pair programming, generating and refactoring code with AI, debugging with AI, and prompting for production-quality code instead of toy snippets.",
    tech: "Cursor Mastery, AI Pair Programming, Code Generation, AI Refactoring, AI Debugging, GitHub Copilot vs Cursor, Prompting for Code",
    project: "AI-Generated Landing Page",
  },
  {
    day: 3,
    label: "Day 03",
    problem:
      "Anyone can chat with AI in a browser tab. Companies pay engineers who can wire AI directly into a real product, not people who copy-paste answers.",
    solution:
      "Move from consuming AI to shipping it — call the OpenAI and Gemini APIs directly, stream responses in real time, and return structured, production-ready JSON your app can actually use.",
    tech: "OpenAI API, Gemini API, Chat Completions, Streaming Responses, JSON Mode, Structured Outputs, Error Handling",
    project: "📄 AI Resume Analyzer",
  },
  {
    day: 4,
    label: "Day 04",
    problem:
      "Generic AI doesn't know your business, your docs, or your data — which is exactly why most AI demos fall apart the moment they meet the real world.",
    solution:
      "Build AI that actually knows your data. Understand why LLMs hallucinate, then fix it with embeddings, vector databases, and a real RAG pipeline that answers questions from your own documents.",
    tech: "Why LLMs Hallucinate, Embeddings, Vector Databases, Chunking, Similarity Search, RAG Pipeline, PDF Processing",
    project: "📚 Chat With Your Own PDFs",
  },
  {
    day: 5,
    label: "Day 05",
    problem:
      "A chatbot answers questions. An agent gets things done on its own. That one difference is driving most of the AI engineering job market right now.",
    solution:
      "Build AI that thinks, plans and acts — tool calling, function calling, memory and multi-step reasoning, using the same MCP fundamentals powering today's agent frameworks.",
    tech: "What Are AI Agents?, Tool Calling, Function Calling, Memory, Planning, MCP Basics, Multi-Step Workflows",
    project: "Your Own AI Research Agent",
  },
  {
    day: 6,
    label: "Day 06",
    problem:
      "A demo running on your laptop means nothing to an employer. A live product with real users is the portfolio piece that actually gets you hired.",
    solution:
      "Combine everything you've built — auth, an AI chat interface, RAG, file uploads — into one production AI SaaS, deployed live with real environment configs and production best practices.",
    tech: "Authentication, AI Chat Interface, RAG Integration, File Upload, Deployment, Environment Variables, Production Best Practices",
    project: "A Live AI SaaS Product",
  },
  {
    day: 7,
    label: "Day 07",
    problem:
      "Skills without a strategy still leave you invisible to recruiters. The engineers who get hired are the ones who know how to prove what they built.",
    solution:
      "Walk away with a career roadmap, not just a certificate — how to package your AI portfolio, position your GitHub, optimize LinkedIn, and go into interviews ready for real AI engineering questions.",
    tech: "AI Engineer Roadmap, AI Portfolio, GitHub Projects, Resume Strategy, LinkedIn Optimization, Interview Preparation, Freelancing vs Jobs",
    project: "Career Roadmap + Final Showcase",
  },
];

export interface BonusItem {
  text: string;
  icon: LucideIcon;
  value: string;
}

export const bonusesList: BonusItem[] = [
  { text: "7 Days of Live Sessions", icon: Video, value: "₹3,000" },
  { text: "1:1 Mentorship", icon: UserCheck, value: "₹2,000" },
  { text: "AI Toolkit", icon: Wrench, value: "₹2,000" },
  { text: "Prompt Library", icon: BookOpen, value: "₹1,000" },
  { text: "Community Access", icon: Users, value: "₹2,000" },
];

export const faqList = [
  {
    q: "Do I need coding experience?",
    a: "No. We build up from the fundamentals — plenty of students start at zero.",
  },
  {
    q: "Is this beginner friendly?",
    a: "Yes. Built for engineering students, freshers and developers with 0–2 years’ experience.",
  },
  {
    q: "Will recordings be available?",
    a: "Yes — every session is recorded and posted in the WhatsApp community.",
  },
  {
    q: "Do we build projects?",
    a: "Every day ends with a real project, built live — not a slide deck.",
  },
  {
    q: "How is this different from YouTube?",
    a: "A mentor reviews your code. YouTube doesn’t.",
  },
];

export const whatsappBenefitsList = [
  { text: "Zoom Links" },
  { text: "Daily Resources" },
  { text: "Session Reminders" },
  { text: "Assignments" },
  { text: "Announcements" },
];

/** The multi-tool grid for the "AI Engineers" side of the beginner/engineer
 *  comparison — deliberately spans code, chat, design, video and research
 *  tools to sell "chooses the best AI for every task" at a glance. */
export const compareLogos: { toolId: string; name: string }[] = [
  { toolId: "chatgpt", name: "ChatGPT" },
  { toolId: "claude", name: "Claude" },
  { toolId: "gemini", name: "Gemini" },
  { toolId: "cursor", name: "Cursor" },
  { toolId: "github", name: "GitHub Copilot" },
  { toolId: "perplexity", name: "Perplexity" },
  { toolId: "n8n", name: "n8n" },
  { toolId: "vercel", name: "Vercel" },
  { toolId: "v0", name: "v0" },
  { toolId: "midjourney", name: "Midjourney" },
  { toolId: "runway", name: "Runway" },
  { toolId: "openai", name: "OpenAI" },
];

export interface WorkflowStep {
  toolId: string;
  name: string;
  why: string;
}

export interface BuildWorkflow {
  id: string;
  label: string;
  steps: WorkflowStep[];
}

/** Curated tool chains for the "What do you want to build?" moment —
 *  ordered as a real workflow (left to right), not an alphabetical list. */
export const buildWorkflows: BuildWorkflow[] = [
  {
    id: "apps",
    label: "Apps",
    steps: [
      { toolId: "cursor", name: "Cursor", why: "Where you write and edit code — AI that reads your whole repo." },
      { toolId: "claude-code", name: "Claude Code", why: "Hands off entire features to an agent in your terminal." },
      { toolId: "openai", name: "OpenAI", why: "The reasoning engine running inside the product itself." },
      { toolId: "vercel", name: "Vercel", why: "Takes it from localhost to a live URL in one push." },
    ],
  },
  {
    id: "interfaces",
    label: "Interfaces",
    steps: [
      { toolId: "v0", name: "v0", why: "Turns a text prompt into a working interface." },
      { toolId: "figma", name: "Figma", why: "Where the AI's first draft gets a designer's eye." },
      { toolId: "framerai", name: "Framer AI", why: "Publishes the design as a real, fast website." },
      { toolId: "cursor", name: "Cursor", why: "Wires the interface to real data and logic." },
    ],
  },
  {
    id: "automations",
    label: "Automations",
    steps: [
      { toolId: "n8n", name: "n8n", why: "Wires your apps together into one visual workflow." },
      { toolId: "make", name: "Make", why: "Handles the no-code automations n8n doesn't." },
      { toolId: "claude", name: "Claude", why: "Adds judgment — reading, deciding, writing — inside it." },
    ],
  },
  {
    id: "content",
    label: "Content",
    steps: [
      { toolId: "runway", name: "Runway", why: "Generates and edits video from a single prompt." },
      { toolId: "heygen", name: "HeyGen", why: "Puts an AI presenter in front of the camera." },
      { toolId: "elevenlabs", name: "ElevenLabs", why: "Gives it a voice that doesn't sound like a robot." },
      { toolId: "ideogram", name: "Ideogram", why: "Produces the thumbnails and graphics around it." },
    ],
  },
  {
    id: "research",
    label: "Research",
    steps: [
      { toolId: "perplexity", name: "Perplexity", why: "Searches the live web and cites its sources." },
      { toolId: "chatgpt", name: "ChatGPT", why: "Synthesizes everything into a first draft." },
      { toolId: "claude", name: "Claude", why: "Reasons through the long, messy parts carefully." },
    ],
  },
];

/** Maps tool ids to real brand artwork in /public/logo or /public/bootcamplogos —
 *  the rest fall back to a generated monogram tile (see ToolLogo.tsx). Ids without
 *  an entry here had no matching brand asset supplied (or the only asset supplied
 *  for that id was broken/mismatched/mislabeled) — see integration notes. */
export const toolLogoOverrides: Record<string, string> = {
  chatgpt: "/bootcamplogos/chatgpt.png",
  claude: "/logo/claude-color.svg",
  "claude-code": "/bootcamplogos/claudecode-color.png",
  runway: "/logo/runway.svg",
  cursor: "/bootcamplogos/cursor.png",
  bolt: "/bootcamplogos/bolt-ai.jpg",
  elevenlabs: "/bootcamplogos/elevenlabs.png",
  vapi: "/bootcamplogos/vapi.png",
  langgraph: "/bootcamplogos/langgraph-color.png",
  midjourney: "/bootcamplogos/midjourney.png",
  ideogram: "/bootcamplogos/ideogram.png",
  heygen: "/bootcamplogos/heygen.png",
  n8n: "/bootcamplogos/n8n-color.png",
  make: "/bootcamplogos/make-color.png",
  perplexity: "/bootcamplogos/perplexity-color.png",
  gamma: "/bootcamplogos/gamma-icon.png",
  beautifulai: "/bootcamplogos/beautiful-ai.jpeg",
  jasper: "/bootcamplogos/jasper.png",
  copyai: "/bootcamplogos/copyai.png",
  framerai: "/bootcamplogos/framer.png",
  openai: "/bootcamplogos/openai.png",
  vercel: "/bootcamplogos/vercel.png",
  figma: "/bootcamplogos/figma-color.png",
  v0: "/bootcamplogos/v0.png",
  gemini: "/bootcamplogos/gemini-color.png",
  github: "/bootcamplogos/github-copilot.png",
  // dalle: intentionally left on the monogram fallback — the only supplied
  // asset (dalle-color.png) is plain color bars, not DALL·E's actual mark.
  // firecrawl, higgsfield, kimi, galileo: no usable asset was supplied for
  // these ids (kimi's only file is named "unidentified-broken-kimi.png" and
  // is a corrupted/blank image) — see integration notes.
};
