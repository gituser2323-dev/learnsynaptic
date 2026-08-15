import {
  LayoutDashboard,
  Users,
  Megaphone,
  ClipboardList,
  CalendarCheck,
  TrendingUp,
  MessageCircle,
  Inbox,
  Workflow,
  FileText,
  Contact,
  Settings,
  ScrollText,
  CheckSquare,
  Kanban,
  CreditCard,
  Gauge,
  ShieldCheck,
  Activity,
  FormInput,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

export type NavGroup = "Overview" | "Growth" | "Automation" | "System";
export type NavMinRole = "counsellor" | "manager" | "admin";

const NAV_ROLE_RANK: Record<NavMinRole, number> = { counsellor: 1, manager: 2, admin: 3 };

/** Same rank comparison lib/api/roles.ts's hasRequiredRole() does
 *  server-side — duplicated in this one small, dependency-free form
 *  rather than importing a lib/api/ module into client nav config, since
 *  this is purely "which nav items would 404/403 for this role," not an
 *  access-control decision itself (every route still enforces its own
 *  requiredRole regardless of what the sidebar shows). */
export function navItemVisible(minRole: NavMinRole | undefined, userRole: NavMinRole | undefined): boolean {
  if (!minRole) return true;
  if (!userRole) return false;
  return NAV_ROLE_RANK[userRole] >= NAV_ROLE_RANK[minRole];
}

export interface NavSearchEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  keywords: string[];
  group: NavGroup;
  /** Lowest role that can actually use this page — hides it from the
   *  sidebar/command palette for anyone below that tier instead of
   *  showing a link that just 403s. Omit for pages every authenticated
   *  staff member can open. */
  minRole?: NavMinRole;
}

/** Single source of truth for both Sidebar.tsx's grouped nav and
 *  DashboardHeader.tsx's command palette, so the two navigation
 *  surfaces can never drift out of sync. Enterprise CRM (Phase 1) adds
 *  Tasks and Pipeline — the only two genuinely new top-level surfaces;
 *  everything else (Tags, Custom Fields, Assignment Rules, Duplicates)
 *  lives inside an existing page (Leads, Settings) rather than earning
 *  its own nav entry, per the "reuse Sidebar/Navigation, don't redesign"
 *  constraint. */
export const NAV_SEARCH_INDEX: NavSearchEntry[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, keywords: ["overview", "home"], group: "Overview" },
  { href: "/admin/executive", label: "Executive Dashboard", icon: Gauge, keywords: ["command center", "owner", "revenue", "kpi", "business performance"], group: "Overview", minRole: "admin" },
  { href: "/admin/analytics", label: "Analytics", icon: TrendingUp, keywords: ["charts", "funnel", "utm"], group: "Overview", minRole: "manager" },
  { href: "/admin/leads", label: "Leads", icon: Users, keywords: ["contacts", "prospects"], group: "Growth" },
  {
    href: "/admin/lead-capture",
    label: "Lead Capture",
    icon: FormInput,
    keywords: ["forms", "public form", "landing", "capture", "widget", "embed"],
    group: "Growth",
    minRole: "manager",
  },
  {
    href: "/admin/appointments",
    label: "Appointments",
    icon: CalendarClock,
    keywords: ["booking", "scheduling", "slots", "counsellor", "meeting"],
    group: "Growth",
    minRole: "manager",
  },
  { href: "/admin/pipeline", label: "Pipeline", icon: Kanban, keywords: ["opportunities", "kanban", "deals"], group: "Growth", minRole: "manager" },
  { href: "/admin/tasks", label: "Tasks", icon: CheckSquare, keywords: ["reminders", "follow-up", "todo"], group: "Growth" },
  { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone, keywords: ["marketing", "ads"], group: "Growth", minRole: "admin" },
  { href: "/admin/registrations", label: "Registrations", icon: ClipboardList, keywords: ["students", "cohort"], group: "Growth", minRole: "admin" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, keywords: ["transactions", "razorpay", "stripe", "cashfree", "refunds", "revenue"], group: "Growth", minRole: "manager" },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck, keywords: ["sessions", "present"], group: "Growth", minRole: "admin" },
  { href: "/admin/conversations", label: "Conversations", icon: Inbox, keywords: ["inbox", "thread", "chat", "replies"], group: "Automation", minRole: "admin" },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle, keywords: ["messages", "delivery"], group: "Automation", minRole: "admin" },
  { href: "/admin/automation", label: "Workflows", icon: Workflow, keywords: ["automation", "runs"], group: "Automation", minRole: "admin" },
  { href: "/admin/templates", label: "Templates", icon: FileText, keywords: ["whatsapp templates", "meta"], group: "Automation", minRole: "admin" },
  { href: "/admin/contacts", label: "Contacts", icon: Contact, keywords: ["directory"], group: "System" },
  {
    href: "/admin/reliability",
    label: "Reliability",
    icon: Activity,
    keywords: ["jobs", "queue", "dead letter", "dlq", "retry", "background jobs", "scheduler"],
    group: "System",
    minRole: "admin",
  },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, keywords: ["security", "history"], group: "System", minRole: "admin" },
  { href: "/admin/settings", label: "Settings", icon: Settings, keywords: ["config", "account"], group: "System", minRole: "manager" },
  {
    href: "/admin/settings/security",
    label: "Security",
    icon: ShieldCheck,
    keywords: ["password", "mfa", "2fa", "sessions", "login history", "connected accounts", "oauth"],
    group: "System",
  },
];

export const NAV_GROUPS: NavGroup[] = ["Overview", "Growth", "Automation", "System"];
