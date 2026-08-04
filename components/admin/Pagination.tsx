import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm" style={{ borderColor: "var(--adm-border)" }}>
      <p style={{ color: "var(--adm-text-muted)" }}>
        Page <span style={{ color: "var(--adm-text)" }}>{page}</span> of {totalPages} · {total.toLocaleString("en-IN")} total
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="adm-focus-ring adm-btn adm-btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={14} /> Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="adm-focus-ring adm-btn adm-btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
