"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAdminTheme } from "../AdminThemeContext";
import { CHART_PALETTE } from "./palette";
import { ChartTooltip } from "./ChartTooltip";

export interface DonutSlice {
  label: string;
  value: number;
  color: "accent" | "accent2" | "success" | "warning" | "danger" | "info";
}

/** A donut with the total centered inside it — used for status
 *  breakdowns (e.g. registrations by status) where every slice is a
 *  real count from the same already-fetched aggregate, never inferred. */
export function DonutStat({ title, slices }: { title: string; slices: DonutSlice[] }) {
  const { theme } = useAdminTheme();
  const c = CHART_PALETTE[theme];
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const data = slices.map((s) => ({ name: s.label, value: s.value, color: c[s.color] }));

  return (
    <div className="adm-card adm-animate-in p-5">
      <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
        {title}
      </p>
      <div className="relative mt-2 h-52">
        {total === 0 ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--adm-text-muted)" }}>
            No data yet
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="92%"
                  paddingAngle={total > 0 ? 3 : 0}
                  strokeWidth={0}
                  animationDuration={700}
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--adm-text)" }}>
                {total.toLocaleString("en-IN")}
              </span>
              <span className="text-[11px]" style={{ color: "var(--adm-text-muted)" }}>
                total
              </span>
            </div>
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--adm-text-secondary)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: c[s.color] }} />
            {s.label} <span style={{ color: "var(--adm-text-muted)" }}>({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
