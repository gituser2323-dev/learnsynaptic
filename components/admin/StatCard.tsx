"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

export type StatTone = "accent" | "success" | "warning" | "danger" | "info";

const TONE_COLOR: Record<StatTone, string> = {
  accent: "var(--adm-accent)",
  success: "var(--adm-success)",
  warning: "var(--adm-warning)",
  danger: "var(--adm-danger)",
  info: "var(--adm-info)",
};

/** Counts up from 0 to a numeric value on mount/change — purely a
 *  presentation touch, skipped entirely for non-numeric values (e.g.
 *  already-formatted strings like "12.4%" or "—" for unavailable
 *  metrics, see the doc comment below). Respects reduced-motion by
 *  jumping straight to the final value. */
function useCountUp(value: number | null, durationMs = 700): number {
  const [display, setDisplay] = useState(value ?? 0);
  const prevRef = useRef(value ?? 0);

  useEffect(() => {
    if (value === null) return;
    const target: number = value;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      prevRef.current = target;
      const id = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(id);
    }
    const from = prevRef.current;
    const delta = target - from;
    if (delta === 0) return;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return display;
}

/**
 * A single executive metric card — used across Overview, Analytics, and
 * the WhatsApp campaign detail page. Renders `null`/`undefined` values
 * as an em dash rather than "0" or "null": this dashboard surfaces
 * several genuinely-unavailable metrics (no ad provider configured, no
 * Payments module yet) and conflating "no data" with "zero" would
 * misreport them as confirmed facts.
 *
 * `icon`/`tone`/`trend` are optional — every existing call site only
 * passes label/value/sublabel and renders identically to before; pages
 * that do have a real icon or a real period-over-period delta can opt
 * in without a breaking change.
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "accent",
  trend,
}: {
  label: string;
  value: string | number | null | undefined;
  sublabel?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  /** Real period-over-period percent change only — never fabricate one. */
  trend?: number;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  const numericValue = typeof value === "number" ? value : null;
  const animated = useCountUp(numericValue);
  const color = TONE_COLOR[tone];

  return (
    <div className="adm-card adm-card-hover adm-animate-in relative overflow-hidden p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-[0.14] blur-2xl"
        style={{ background: color }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
          {label}
        </p>
        {Icon && (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--adm-radius-md)]"
            style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
          >
            <Icon size={15} />
          </span>
        )}
      </div>

      <p className="relative mt-3 text-[1.75rem] font-bold leading-tight tabular-nums" style={{ color: "var(--adm-text)" }}>
        {isEmpty ? "—" : numericValue !== null ? animated.toLocaleString("en-IN") : value}
      </p>

      <div className="relative mt-2 flex items-center gap-2">
        {typeof trend === "number" && (
          <span
            className="inline-flex items-center gap-0.5 text-xs font-semibold"
            style={{ color: trend >= 0 ? "var(--adm-success)" : "var(--adm-danger)" }}
          >
            {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {sublabel && (
          <p className="truncate text-xs" style={{ color: "var(--adm-text-muted)" }}>
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}
