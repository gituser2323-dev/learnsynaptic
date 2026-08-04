/**
 * RC-1 stabilization: three lead-capture surfaces (the AI Bootcamp and
 * AI Generalist registration modals, the site-wide exit-intent popup)
 * are deliberately WhatsApp-number-only, low-friction funnels — no
 * email field, by product design, and changing that is a UI/product
 * decision this stabilization pass is explicitly not scoped to make.
 *
 * `Lead.email` is a required, validated field (lib/services/leads/
 * validation.ts) and changing that is an architecture change this pass
 * is also not scoped to make (email is assumed present by, at minimum,
 * the WhatsApp Campaign Manager's "filter" audience source, which reads
 * Lead records).
 *
 * Given both constraints hold, this is the smallest production-safe
 * bridge: a deterministic, clearly-marked, non-deliverable placeholder
 * address derived from the phone number, so these leads still reach the
 * CRM (and therefore Automation/Audit Log/Analytics) without adding a
 * field to a funnel that was intentionally designed without one. The
 * `@leads.invalid` domain is reserved for exactly this purpose (RFC
 * 2606-style convention of using an obviously-non-routable domain) —
 * never sent real mail, and immediately recognizable to anyone looking
 * at the Leads table why a row has no real email.
 */
export function syntheticEmailFromPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/[^0-9]/g, "");
  return `wa-${digits}@leads.invalid`;
}
