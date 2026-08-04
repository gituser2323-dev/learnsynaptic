"use client";

import { useState } from "react";
import type { DateRangePreset } from "@/lib/services/revenueAnalytics";
import { FormField } from "./FormField";

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 Days",
  last30: "Last 30 Days",
  thisMonth: "This Month",
  prevMonth: "Previous Month",
};

const PRESETS: DateRangePreset[] = ["today", "yesterday", "last7", "last30", "thisMonth", "prevMonth"];

export interface DateRangeSelection {
  preset?: DateRangePreset;
  from?: string;
  to?: string;
}

/** Enterprise Analytics (Phase 7), module 7.2 — Date Filtering (mission
 *  §10): Today/Yesterday/Last 7/Last 30/This Month/Previous Month as
 *  one-click pills, plus a Custom Range fallback (two date inputs, the
 *  same FormField the rest of this dashboard already uses). Boundary
 *  math (IST-aware, inclusive) lives server-side in
 *  lib/services/revenueAnalytics/dateRanges.ts — this component only
 *  ever sends a preset name or two plain YYYY-MM-DD strings. */
export function DateRangePicker({ value, onChange }: { value: DateRangeSelection; onChange: (next: DateRangeSelection) => void }) {
  const [customFrom, setCustomFrom] = useState(value.from ?? "");
  const [customTo, setCustomTo] = useState(value.to ?? "");
  const isCustom = !value.preset;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range preset">
        {PRESETS.map((preset) => {
          const active = value.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange({ preset })}
              aria-pressed={active}
              className="adm-focus-ring rounded-[var(--adm-radius-full)] px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: active ? "var(--adm-accent)" : "var(--adm-surface-2)",
                color: active ? "#fff" : "var(--adm-text-secondary)",
                border: `1px solid ${active ? "var(--adm-accent)" : "var(--adm-line)"}`,
              }}
            >
              {PRESET_LABELS[preset]}
            </button>
          );
        })}
      </div>
      <div className="flex items-end gap-2">
        <FormField
          id="rev-analytics-from"
          label="From"
          type="date"
          value={customFrom}
          onChange={(e) => {
            setCustomFrom(e.target.value);
            if (e.target.value && customTo) onChange({ from: e.target.value, to: customTo });
          }}
        />
        <FormField
          id="rev-analytics-to"
          label="To"
          type="date"
          value={customTo}
          onChange={(e) => {
            setCustomTo(e.target.value);
            if (customFrom && e.target.value) onChange({ from: customFrom, to: e.target.value });
          }}
        />
      </div>
      {isCustom && customFrom && customTo && (
        <span className="pb-2 text-xs" style={{ color: "var(--adm-text-muted)" }}>
          Custom range active
        </span>
      )}
    </div>
  );
}
