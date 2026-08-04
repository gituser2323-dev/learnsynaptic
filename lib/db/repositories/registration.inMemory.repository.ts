import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateRegistrationInput,
  Registration,
  RegistrationAnalytics,
  RegistrationListFilters,
  RegistrationRepository,
  RegistrationStatus,
} from "./types";

const ALL_STATUSES: RegistrationStatus[] = ["pending", "confirmed", "cancelled"];

const store: Registration[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryRegistrationRepository: RegistrationRepository = {
  async findById(id: string): Promise<Registration | null> {
    return findOwnedByTenant(store, (r) => r.id === id) ?? null;
  },

  async findByLeadAndProgram(leadId: string, programSlug: string): Promise<Registration | null> {
    return scopeToTenant(store).find((r) => r.leadId === leadId && r.programSlug === programSlug) ?? null;
  },

  async findByLead(leadId: string): Promise<Registration[]> {
    return scopeToTenant(store).filter((r) => r.leadId === leadId);
  },

  async create(input: CreateRegistrationInput): Promise<Registration> {
    const exists = scopeToTenant(store).some((r) => r.leadId === input.leadId && r.programSlug === input.programSlug);
    if (exists) {
      throw new DuplicateKeyError("Registration", { leadId: input.leadId, programSlug: input.programSlug });
    }
    const registration: Registration = stampTenant<Registration>({
      ...input,
      status: "pending",
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(registration);
    return registration;
  },

  async updateStatus(id: string, status: RegistrationStatus): Promise<Registration> {
    const registration = findOwnedByTenant(store, (r) => r.id === id);
    if (!registration) throw new Error(`Registration ${id} not found`);
    registration.status = status;
    registration.updatedAt = nowIso();
    return registration;
  },

  async list(
    filters: RegistrationListFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Registration>> {
    let results = scopeToTenant(store);
    if (filters.status) results = results.filter((r) => r.status === filters.status);
    if (filters.programSlug) results = results.filter((r) => r.programSlug === filters.programSlug);
    if (filters.campaignId) results = results.filter((r) => r.campaignId === filters.campaignId);
    if (filters.createdAfter) results = results.filter((r) => r.createdAt >= filters.createdAfter!);
    if (filters.createdBefore) results = results.filter((r) => r.createdAt <= filters.createdBefore!);
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async analytics(): Promise<RegistrationAnalytics> {
    const byStatus = ALL_STATUSES.reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<RegistrationStatus, number>,
    );
    const byProgramMap = new Map<string, number>();

    const scoped = scopeToTenant(store);
    for (const registration of scoped) {
      byStatus[registration.status] += 1;
      byProgramMap.set(registration.programSlug, (byProgramMap.get(registration.programSlug) ?? 0) + 1);
    }

    const byProgram = Array.from(byProgramMap.entries())
      .map(([programSlug, count]) => ({ programSlug, count }))
      .sort((a, b) => b.count - a.count);

    return { totalRegistrations: scoped.length, byStatus, byProgram };
  },
};
