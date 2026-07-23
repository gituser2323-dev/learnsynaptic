import type { LucideIcon } from "lucide-react";
import {
  Clock,
  Layers,
  TrendingUp,
  Briefcase,
  Rocket,
  Megaphone,
  Laptop,
  MessageCircle,
  Bot,
  Headset,
  FileText,
  Receipt,
  Mail,
  ClipboardList,
  Video,
  UserCheck,
  Wrench,
  BookOpen,
  Users,
} from "lucide-react";

/**
 * Language-independent metadata for the /ai-generalist page: icons, tool
 * ids and array lengths. All translatable copy lives in translations.ts,
 * indexed in the same order as these arrays.
 */

export const awarenessIcons: LucideIcon[] = [Clock, Layers, TrendingUp];

export const audienceIcons: LucideIcon[] = [Briefcase, Rocket, Megaphone, Laptop];

export const projectIcons: LucideIcon[] = [
  MessageCircle,
  Megaphone,
  Bot,
  Headset,
  FileText,
  Receipt,
  Mail,
  ClipboardList,
];

export const bonusIcons: LucideIcon[] = [Video, UserCheck, Wrench, BookOpen, Users];

export interface WorkflowStep {
  toolId: string;
  name: string;
}

export interface BuildWorkflow {
  id: string;
  steps: WorkflowStep[];
}

/** Curated tool chains per business use case — labels and "why" copy live
 *  in translations.ts under problem.workflows[id], aligned by step index. */
export const buildWorkflows: BuildWorkflow[] = [
  {
    id: "marketing",
    steps: [
      { toolId: "chatgpt", name: "ChatGPT" },
      { toolId: "jasper", name: "Jasper" },
      { toolId: "ideogram", name: "Ideogram" },
      { toolId: "canva", name: "Canva" },
    ],
  },
  {
    id: "sales",
    steps: [
      { toolId: "claude", name: "Claude" },
      { toolId: "chatgpt", name: "ChatGPT" },
      { toolId: "gamma", name: "Gamma" },
      { toolId: "docusign", name: "DocuSign" },
    ],
  },
  {
    id: "support",
    steps: [
      { toolId: "whatsapp", name: "WhatsApp Business" },
      { toolId: "manychat", name: "ManyChat" },
      { toolId: "claude", name: "Claude" },
      { toolId: "hubspot", name: "HubSpot" },
    ],
  },
  {
    id: "automation",
    steps: [
      { toolId: "n8n", name: "n8n" },
      { toolId: "make", name: "Make" },
      { toolId: "zapier", name: "Zapier" },
      { toolId: "gemini", name: "Gemini" },
    ],
  },
  {
    id: "reporting",
    steps: [
      { toolId: "chatgpt", name: "ChatGPT" },
      { toolId: "notion", name: "Notion AI" },
      { toolId: "googlesheets", name: "Google Sheets" },
      { toolId: "gamma", name: "Gamma" },
    ],
  },
];

/** "Smart Business Owners" logo grid — mirrors /ai-bootcamp's compareLogos
 *  pattern, swapped for business-relevant tools. */
export const compareLogos: { toolId: string; name: string }[] = [
  { toolId: "chatgpt", name: "ChatGPT" },
  { toolId: "claude", name: "Claude" },
  { toolId: "gemini", name: "Gemini" },
  { toolId: "n8n", name: "n8n" },
  { toolId: "make", name: "Make" },
  { toolId: "canva", name: "Canva" },
  { toolId: "notion", name: "Notion" },
  { toolId: "zapier", name: "Zapier" },
  { toolId: "whatsapp", name: "WhatsApp Business" },
  { toolId: "asana", name: "Asana" },
  { toolId: "gamma", name: "Gamma" },
  { toolId: "hubspot", name: "HubSpot" },
];

/** Real brand assets already available in /public/bootcamplogos — every
 *  other tool id falls back to ToolLogo's generated monogram tile, the
 *  same honest-placeholder pattern used on /ai-bootcamp. */
export const toolLogoOverrides: Record<string, string> = {
  chatgpt: "/bootcamplogos/chatgpt.png",
  claude: "/logo/claude-color.svg",
  gemini: "/bootcamplogos/gemini-color.png",
  n8n: "/bootcamplogos/n8n-color.png",
  make: "/bootcamplogos/make-color.png",
  jasper: "/bootcamplogos/jasper.png",
  ideogram: "/bootcamplogos/ideogram.png",
  gamma: "/bootcamplogos/gamma-icon.png",
};
