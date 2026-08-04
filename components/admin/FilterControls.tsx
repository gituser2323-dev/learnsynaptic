/** Shared styling for the small filter bars atop Leads/Campaigns/
 *  Registrations/Attendance — every field is `aria-label`led rather
 *  than paired with a visible `<label>` (the Performance Optimization
 *  module's audit fixed the same gap on the marketing site's forms for
 *  the same reason: a filter bar's fields are self-explanatory from
 *  their placeholder, but still need a real accessible name). */

export function FilterInput({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <input
      aria-label={label}
      className={`adm-input adm-focus-ring ${className ?? ""}`}
      {...props}
    />
  );
}

export function FilterSelect({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <select aria-label={label} className={`adm-input adm-focus-ring ${className ?? ""}`} {...props}>
      {children}
    </select>
  );
}
