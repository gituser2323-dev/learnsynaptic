"use client";

import { useAdminTheme } from "../AdminThemeContext";
import { CHART_PALETTE } from "./palette";

/** Shared tooltip renderer for every recharts instance in the admin
 *  dashboard — recharts' own default tooltip ignores our design tokens
 *  entirely, so every chart passes `content={<ChartTooltip />}`. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number | string; color?: string }[];
  label?: string;
  formatter?: (value: number | string, name: string) => string;
}) {
  const { theme } = useAdminTheme();
  const c = CHART_PALETTE[theme];
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-[var(--adm-radius-md)] border px-3 py-2 text-xs shadow-xl"
      style={{ background: c.tooltipBg, borderColor: c.tooltipBorder }}
    >
      {label && (
        <p className="mb-1 font-semibold" style={{ color: c.text }}>
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color ?? c.accent }} />
          <span style={{ color: c.text }}>{entry.name}:</span>
          <span className="font-semibold" style={{ color: theme === "dark" ? "#fff" : "#14161f" }}>
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
