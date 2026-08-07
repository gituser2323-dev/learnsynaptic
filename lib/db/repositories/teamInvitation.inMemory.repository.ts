import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateTeamInvitationInput,
  TeamInvitation,
  TeamInvitationRepository,
  UpdateTeamInvitationInput,
} from "@/lib/services/onboarding/invitationTypes";

const store: TeamInvitation[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryTeamInvitationRepository: TeamInvitationRepository = {
  async findById(id: string): Promise<TeamInvitation | null> {
    return store.find((i) => i.id === id) ?? null;
  },

  async findByTokenHash(tokenHash: string): Promise<TeamInvitation | null> {
    return store.find((i) => i.tokenHash === tokenHash) ?? null;
  },

  async findPendingByOrganizationAndEmail(organizationId: string, email: string): Promise<TeamInvitation | null> {
    const lower = email.toLowerCase();
    return store.find((i) => i.organizationId === organizationId && i.email === lower && i.status === "pending") ?? null;
  },

  async create(input: CreateTeamInvitationInput): Promise<TeamInvitation> {
    const invitation: TeamInvitation = {
      ...input,
      email: input.email.toLowerCase(),
      status: "pending",
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.push(invitation);
    return invitation;
  },

  async update(id: string, patch: UpdateTeamInvitationInput): Promise<TeamInvitation> {
    const invitation = store.find((i) => i.id === id);
    if (!invitation) throw new Error(`TeamInvitation ${id} not found`);
    Object.assign(invitation, patch, { updatedAt: nowIso() });
    return invitation;
  },

  async listByOrganization(organizationId: string, page: number, limit: number): Promise<PaginatedResult<TeamInvitation>> {
    const results = store
      .filter((i) => i.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async countPendingByOrganization(organizationId: string): Promise<number> {
    return store.filter((i) => i.organizationId === organizationId && i.status === "pending").length;
  },
};
