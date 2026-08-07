import { getOrganizationRepository, getUserRepository } from "@/lib/db";
import { subscriptionService } from "@/lib/services/billing";
import { runCrossTenantSweep } from "@/lib/tenancy/context";
import type { Organization } from "@/lib/services/organizations";
import type { PublicUser } from "@/lib/services/auth";
import type { Subscription } from "@/lib/services/billing";

export interface PlatformSearchResult {
  organizations: Organization[];
  users: (PublicUser & { organizationId?: string })[];
  subscriptions: Subscription[];
}

const MAX_RESULTS_PER_CATEGORY = 10;

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console: search limited
 * to exactly what the mission names — organization name/id, user email,
 * subscription reference — never customer CRM contents (leads,
 * conversations, campaigns). This is an operator directory lookup, not
 * a general-purpose cross-tenant data search.
 */
export async function searchPlatform(query: string): Promise<PlatformSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { organizations: [], users: [], subscriptions: [] };

  const organizationRepository = await getOrganizationRepository();
  const userRepository = await getUserRepository();

  const [orgById, orgsBySearch, allUsers, allSubscriptions] = await Promise.all([
    organizationRepository.findById(trimmed).catch(() => null),
    organizationRepository.list({ search: trimmed }, 1, MAX_RESULTS_PER_CATEGORY),
    userRepository.listActive(),
    // Subscription carries tenantScopePlugin (unlike Organization/User,
    // neither of which was ever tenant-scoped) — without this sweep,
    // listAllForScheduler() would silently return only whichever single
    // organization the calling platform operator's own token happens
    // to carry. See subscriptionService.listAllForScheduler's own doc
    // comment.
    runCrossTenantSweep(() => subscriptionService.listAllForScheduler()),
  ]);

  const organizations = orgById
    ? [orgById, ...orgsBySearch.items.filter((o) => o.id !== orgById.id)]
    : orgsBySearch.items;

  const lowerQuery = trimmed.toLowerCase();
  const users = allUsers
    .filter((u) => u.email.toLowerCase().includes(lowerQuery))
    .slice(0, MAX_RESULTS_PER_CATEGORY)
    .map((u) => ({ id: u.id, email: u.email, role: u.role, name: u.name, emailVerified: Boolean(u.emailVerifiedAt), mfaEnabled: u.mfaEnabled, organizationId: u.organizationId }));

  const subscriptions = allSubscriptions
    .filter(
      (s) =>
        s.id === trimmed ||
        s.organizationId === trimmed ||
        s.providerRef?.subscriptionId === trimmed ||
        s.providerRef?.customerId === trimmed,
    )
    .slice(0, MAX_RESULTS_PER_CATEGORY);

  return { organizations: organizations.slice(0, MAX_RESULTS_PER_CATEGORY), users, subscriptions };
}
