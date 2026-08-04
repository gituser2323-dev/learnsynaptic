/**
 * JS-side mirror of the dark/light color tokens in globals.css's
 * `.admin-shell`. Recharts renders into SVG `<defs>`/gradients where
 * `var(--adm-*)` resolution can be inconsistent across browsers, so
 * chart color values are duplicated here deliberately rather than read
 * from CSS — keep these in sync by hand if the token values change.
 */
export const CHART_PALETTE = {
  dark: {
    accent: "#6366f1",
    accent2: "#22d3ee",
    success: "#34d399",
    warning: "#fbbf24",
    danger: "#f87171",
    info: "#60a5fa",
    grid: "rgba(255,255,255,0.08)",
    text: "#a3a8b8",
    tooltipBg: "#181b26",
    tooltipBorder: "rgba(255,255,255,0.12)",
  },
  light: {
    accent: "#6366f1",
    accent2: "#0891b2",
    success: "#059669",
    warning: "#d97706",
    danger: "#dc2626",
    info: "#2563eb",
    grid: "rgba(15,23,42,0.08)",
    text: "#585d6e",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e6e8f0",
  },
} as const;

export const SERIES_COLORS = [
  "accent",
  "accent2",
  "success",
  "warning",
  "info",
  "danger",
] as const;
