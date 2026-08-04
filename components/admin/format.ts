/**
 * Shared number formatting for Overview and Marketing — both display
 * metrics that are `null` by design (no attendance recorded yet, no ad
 * provider connected, no Payments module) rather than 0. Every
 * formatter here renders `null` as an em dash, never "0" or "NaN", so
 * the UI never misreports "no data" as "confirmed zero."
 */

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

export function formatCurrencyInr(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    value,
  );
}

export function formatNumber(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
}
