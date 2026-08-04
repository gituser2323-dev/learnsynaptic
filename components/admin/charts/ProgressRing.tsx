"use client";

import { useEffect, useState } from "react";

/** A single-value radial progress indicator — pure SVG (no recharts
 *  overhead needed for one ring). `value` is null when the underlying
 *  metric is genuinely unavailable (e.g. no attendance recorded yet at
 *  all) — rendered as an empty track with an em dash, same "don't
 *  conflate missing with zero" rule as StatCard. */
export function ProgressRing({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: number | null;
  sublabel?: string;
}) {
  const [animated, setAnimated] = useState(0);
  const size = 128;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (value === null) return;
    const raf = requestAnimationFrame(() => setAnimated(value));
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const pct = Math.max(0, Math.min(1, animated));
  const offset = circumference * (1 - pct);
  const color = value === null ? "var(--adm-text-muted)" : pct >= 0.7 ? "var(--adm-success)" : pct >= 0.4 ? "var(--adm-warning)" : "var(--adm-danger)";

  return (
    <div className="adm-card adm-animate-in flex flex-col items-center gap-3 p-5 text-center">
      <p className="self-start text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
        {label}
      </p>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--adm-surface-2)" strokeWidth={stroke} />
          {value !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 900ms var(--adm-ease), stroke 300ms ease" }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums" style={{ color: "var(--adm-text)" }}>
          {value === null ? "—" : `${Math.round(pct * 100)}%`}
        </div>
      </div>
      {sublabel && (
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          {sublabel}
        </p>
      )}
    </div>
  );
}
