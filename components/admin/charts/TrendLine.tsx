"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { useAdminTheme } from "../AdminThemeContext";
import { CHART_PALETTE } from "./palette";
import { ChartTooltip } from "./ChartTooltip";

export interface TrendSeries<T> {
  key: keyof T & string;
  label: string;
  color: keyof (typeof CHART_PALETTE)["dark"];
}

/** Day-bucketed trend area chart — Enterprise Analytics (Phase 7),
 *  module 7.2's own "show trends over time where architecture permits"
 *  requirement. Reused across Automation Analytics' executions/
 *  completed/failed trend; any other day-bucketed series in this
 *  dashboard can reuse it too. Generic over T so a real domain type
 *  (e.g. AutomationTrendPoint) can be passed directly without an
 *  index-signature cast. */
export function TrendLine<T extends { date: string }>({
  title,
  data,
  series,
  note,
}: {
  title: string;
  data: T[];
  series: TrendSeries<T>[];
  note?: string;
}) {
  const { theme } = useAdminTheme();
  const c = CHART_PALETTE[theme];

  return (
    <div className="adm-card adm-animate-in p-5">
      <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
        {title}
      </p>
      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm" style={{ color: "var(--adm-text-muted)" }}>
          No data for this range
        </div>
      ) : (
        <div style={{ height: 220 }} className="mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`trend-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c[s.color]} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={c[s.color]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="date" tick={{ fill: c.text, fontSize: 10 }} axisLine={{ stroke: c.grid }} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fill: c.text, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip content={<ChartTooltip />} />
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key as string}
                  name={s.label}
                  stroke={c[s.color]}
                  strokeWidth={2}
                  fill={`url(#trend-fill-${s.key})`}
                  animationDuration={700}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {note && (
        <p className="mt-3 text-xs" style={{ color: "var(--adm-text-muted)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
