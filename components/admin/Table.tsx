export interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  /** Hidden below the `sm` card-layout breakpoint's inline label — set
   *  for a column whose rendered content already carries its own
   *  meaning without a label prefix (e.g. a name used as the card
   *  title). Purely cosmetic, doesn't affect the desktop table. */
  hideMobileLabel?: boolean;
}

/**
 * The one table-chrome definition shared by every dashboard page that
 * renders one (Overview's two breakdowns, Leads, Campaigns,
 * Registrations, Attendance, Marketing's per-campaign table) — column
 * *definitions* stay entirely per-page (that's the part that's actually
 * different each time), only the wrapper markup/styling is shared.
 *
 * Below `sm` the table becomes a stacked list of cards (one per row,
 * each cell rendered as a labelled line) instead of a horizontally
 * scrolling table — a real table has no good small-screen shape, and
 * this dashboard's own design brief explicitly rules out horizontal
 * scroll/compressed cells as an outcome.
 */
export function Table<T>({
  columns,
  rows,
  getRowKey,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
}) {
  return (
    <>
      {/* Desktop / tablet: real table, sticky header, hover rows. */}
      <div className="adm-card hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--adm-border)" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`sticky top-0 z-10 whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide backdrop-blur ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                  style={{ color: "var(--adm-text-muted)", background: "color-mix(in srgb, var(--adm-surface) 92%, transparent)" }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="transition-colors"
                style={{ borderTop: "1px solid var(--adm-border)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--adm-surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}
                    style={{ color: "var(--adm-text)" }}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per row. */}
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <div key={getRowKey(row)} className="adm-card space-y-2 p-4">
            {columns.map((col) => (
              <div key={col.key} className={col.align === "right" ? "flex items-center justify-between gap-3" : ""}>
                {!col.hideMobileLabel && (
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                    {col.header}
                  </p>
                )}
                <div className="text-sm" style={{ color: "var(--adm-text)" }}>
                  {col.render(row)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
