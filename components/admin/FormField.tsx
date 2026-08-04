/**
 * A real data-entry field with a visible `<label>` — distinct from
 * FilterControls.tsx's `FilterInput` (aria-label only, appropriate for
 * a compact filter bar whose fields are self-explanatory from their
 * placeholder). The Mark Attendance form is an actual write action, not
 * a filter — matching the visible-label convention Module 10's
 * accessibility audit established for RegisterForm/ContactForm/
 * InternshipApplyForm, rather than reusing the filter-bar pattern here.
 */
export function FormField({
  id,
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
        {label}
      </label>
      <input id={id} className={`adm-input adm-focus-ring ${className ?? ""}`} {...props} />
    </div>
  );
}
