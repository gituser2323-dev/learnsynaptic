"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useAdminTheme } from "../AdminThemeContext";
import { CHART_PALETTE } from "./palette";
import { ChartTooltip } from "./ChartTooltip";

export interface BarDatum {
  label: string;
  value: number;
}

/** Horizontal bar comparison — used for "registrations by program" and
 *  "top UTM sources," both real grouped counts from already-fetched
 *  aggregates. Horizontal (not vertical) so long program/source labels
 *  never get truncated or rotated on narrow screens. */
export function BarComparison({ title, data, valueLabel }: { title: string; data: BarDatum[]; valueLabel: string }) {
  const { theme } = useAdminTheme();
  const c = CHART_PALETTE[theme];
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 8);
  const height = Math.max(160, sorted.length * 38);

  return (
    <div className="adm-card adm-animate-in p-5">
      <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
        {title}
      </p>
      {sorted.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm" style={{ color: "var(--adm-text-muted)" }}>
          No data yet
        </div>
      ) : (
        <div style={{ height }} className="mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid horizontal={false} stroke={c.grid} />
              <XAxis type="number" tick={{ fill: c.text, fontSize: 11 }} axisLine={{ stroke: c.grid }} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                tick={{ fill: c.text, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip cursor={{ fill: c.grid }} content={<ChartTooltip formatter={(v) => `${v} ${valueLabel}`} />} />
              <Bar dataKey="value" name={valueLabel} radius={[0, 6, 6, 0]} animationDuration={700} maxBarSize={22}>
                {sorted.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? c.accent : c.accent2} fillOpacity={i === 0 ? 1 : 0.55 + 0.45 * (1 - i / sorted.length)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
