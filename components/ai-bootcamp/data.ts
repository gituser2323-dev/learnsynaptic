import type { LucideIcon } from "lucide-react";
import {
  GraduationCap,
  TrendingUp,
  Terminal,
  Briefcase,
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
    description: "Join 5,000+ students who didn't wait for 2027 to catch up.",
  },
  {
    icon: TrendingUp,
    headline: "Not Sure Where to Start?",
    description: "Companies are already hiring AI Engineers for 2027 roles — not just developers who can write code.",
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
  { text: "One real AI project, shipped" },
  { text: "Built around AI from day one" },
  { text: "The workflow real teams use" },
  { text: "A portfolio, not a certificate" },
  { text: "Built for your next role" },
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
    label: "The Session",
    problem:
      "A chatbot answers questions. An agent gets things done on its own. That one difference is driving most of the AI engineering job market right now — and it's only widening on the way to 2027.",
    solution:
      "Build AI that thinks, plans and acts — tool calling, function calling, memory and multi-step reasoning, using the same MCP fundamentals powering today's agent frameworks.",
    tech: "What Are AI Agents?, Tool Calling, Function Calling, Memory, Planning, MCP Basics, Multi-Step Workflows",
    project: "Your Own AI Research Agent",
  },
];

export interface BonusItem {
  text: string;
  icon: LucideIcon;
  value: string;
}

export const bonusesList: BonusItem[] = [
  { text: "2-Hour Live Masterclass", icon: Video, value: "₹3,000" },
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
    a: "The session ends with a real project, built live — not a slide deck.",
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

export interface TestimonialItem {
  name: string;
  outcome: string;
  quote: string;
}

export const testimonialsList: TestimonialItem[] = [
  { name: "[STUDENT NAME]", outcome: "[OUTCOME]", quote: "[QUOTE]" },
  { name: "[STUDENT NAME]", outcome: "[OUTCOME]", quote: "[QUOTE]" },
  { name: "[STUDENT NAME]", outcome: "[OUTCOME]", quote: "[QUOTE]" },
  { name: "[STUDENT NAME]", outcome: "[OUTCOME]", quote: "[QUOTE]" },
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
