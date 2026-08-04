import { Loader2, ShieldAlert, AlertTriangle, Inbox, type LucideIcon } from "lucide-react";

/** Shared across every dashboard page's data-fetching lifecycle (see
 *  useAdminData.ts) — one visual language for "loading," "you don't
 *  have permission," and "something broke," instead of six slightly
 *  different ad-hoc versions. */

function IconBadge({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  return (
    <span
      className="flex h-12 w-12 items-center justify-center rounded-[var(--adm-radius-lg)]"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      <Icon size={22} />
    </span>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="adm-card flex items-center justify-center gap-2.5 py-16">
      <Loader2 size={18} className="animate-spin" style={{ color: "var(--adm-accent)" }} />
      <span className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

export function ForbiddenState({ role }: { role?: string }) {
  return (
    <div className="adm-card adm-animate-in flex flex-col items-center gap-3 px-6 py-16 text-center">
      <IconBadge icon={ShieldAlert} color="var(--adm-warning)" />
      <p className="font-semibold" style={{ color: "var(--adm-text)" }}>
        You don&apos;t have permission to view this
      </p>
      <p className="max-w-sm text-sm" style={{ color: "var(--adm-text-muted)" }}>
        {role ? `Your account role (${role}) doesn't have access to this section.` : "This section requires a higher role."}
      </p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="adm-card adm-animate-in flex flex-col items-center gap-3 px-6 py-16 text-center">
      <IconBadge icon={AlertTriangle} color="var(--adm-danger)" />
      <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
        {message}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="adm-focus-ring adm-btn adm-btn-secondary">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  message,
  icon: Icon = Inbox,
  action,
}: {
  message: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="adm-card adm-animate-in flex flex-col items-center gap-3 px-6 py-16 text-center">
      <IconBadge icon={Icon} color="var(--adm-accent)" />
      <p className="max-w-sm text-sm" style={{ color: "var(--adm-text-muted)" }}>
        {message}
      </p>
      {action && (
        <button type="button" onClick={action.onClick} className="adm-focus-ring adm-btn adm-btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
}
