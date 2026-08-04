"use client";

export interface FunnelStage {
  label: string;
  /** null when the stage's data source isn't connected (e.g. no web
   *  analytics provider) — rendered as an unavailable stage rather than
   *  a fabricated zero. */
  value: number | null;
}

/** A conversion funnel built from real, already-computed stage counts
 *  (e.g. Leads → Registrations, or WhatsApp Queued → Sent → Delivered →
 *  Read) — each bar's width is proportional to the largest *available*
 *  stage, with the drop-off rate between consecutive available stages
 *  shown alongside. */
export function FunnelViz({
  title,
  stages,
  note,
}: {
  title: string;
  stages: FunnelStage[];
  /** Explains why a stage reads "—" (e.g. no analytics/payments provider
   *  connected) — the same "unavailable, not zero" caveat every null
   *  metric in this dashboard carries elsewhere. */
  note?: string;
}) {
  const known = stages.filter((s): s is { label: string; value: number } => s.value !== null);
  const max = Math.max(1, ...known.map((s) => s.value));

  return (
    <div className="adm-card adm-animate-in p-5">
      <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {stages.map((stage, i) => {
          const prev = stages[i - 1];
          const rate =
            stage.value !== null && prev && prev.value !== null && prev.value > 0
              ? (stage.value / prev.value) * 100
              : null;
          const widthPct = stage.value !== null ? Math.max(6, (stage.value / max) * 100) : 100;

          return (
            <div key={stage.label}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="font-medium" style={{ color: "var(--adm-text-secondary)" }}>
                  {stage.label}
                </span>
                <span className="flex items-center gap-2">
                  {rate !== null && (
                    <span style={{ color: "var(--adm-text-muted)" }}>{rate.toFixed(0)}% of previous</span>
                  )}
                  <span className="font-semibold tabular-nums" style={{ color: "var(--adm-text)" }}>
                    {stage.value === null ? "—" : stage.value.toLocaleString("en-IN")}
                  </span>
                </span>
              </div>
              <div className="h-8 overflow-hidden rounded-[var(--adm-radius-sm)]" style={{ background: "var(--adm-surface-2)" }}>
                {stage.value !== null && (
                  <div
                    className="h-full rounded-[var(--adm-radius-sm)] transition-[width] duration-700"
                    style={{
                      width: `${widthPct}%`,
                      background: `linear-gradient(90deg, var(--adm-accent), var(--adm-accent-2))`,
                      opacity: 0.35 + 0.65 * (1 - i * 0.15),
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {note && (
        <p className="mt-3 text-xs" style={{ color: "var(--adm-text-muted)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
