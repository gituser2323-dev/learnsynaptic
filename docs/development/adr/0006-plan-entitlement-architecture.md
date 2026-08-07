# ADR-0006: A global Plan catalog + per-organization Subscription + reversible overrides

**Status: Accepted, implemented (Module 8.3, extended by RC-6, RC-7).**

## Context

This app needs a commercial SaaS entitlement model: which features and
usage limits an organization gets, driven by what it's paying for, with
room for a Platform Super Admin to grant a specific organization a
one-off exception (a sales concession, a support gesture) without
touching the shared plan catalog every other customer on that plan
also uses.

## Decision

`Organization → Subscription → Plan → Entitlements → Usage Limits →
Feature Access`. `Plan` is a single, global, versioned catalog
(deliberately **not** tenant-scoped — the same Plan document is
referenced by every subscribed organization). `Subscription` is
one-per-organization, tenant-scoped, carrying its own status machine
(`trialing → active → past_due → cancelled/suspended/expired`) plus
optional per-organization `capabilityOverrides`/`limitOverrides` that
**merge on top of**, never replace, the shared Plan's own values.

## Consequences

- An override is always reversible and organization-specific — the
  global Plan catalog itself is never mutated by a per-organization
  action, so granting one customer a concession can never accidentally
  change what every other customer on that plan gets.
- **Self-healing, not a backfill script**: any organization with no
  explicit `Subscription` yet is transparently, race-safely
  provisioned onto a real plan the first time its entitlements are
  checked — protecting every future organization automatically, not
  just ones that existed when a migration ran. This was a deliberate
  improvement over this codebase's own earlier backfill-script pattern
  (Module 8.1), chosen specifically because it protects future data
  too.
- Server-side enforcement (`requiredCapability`, `entitlementService`)
  is wired at a **representative, not universal**, set of call sites —
  a disclosed, real scope boundary, not a claim that every conceivable
  limit is enforced everywhere yet.
- No real recurring/auto-charge billing exists on top of this — a
  disclosed, separate gap. This ADR's own state machine correctly
  reacts to a renewal Payment's outcome; nothing here automatically
  *causes* that Payment on a schedule against any of the three real
  payment gateways.
- Plan names are explicitly never hardcoded into feature-gating logic
  anywhere in the codebase — every check goes through a named
  capability, so renaming or restructuring the commercial plan lineup
  never requires touching feature code.
