import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { TeamInvitationModel, toTeamInvitation } from "@/lib/db/models/teamInvitation.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  CreateTeamInvitationInput,
  TeamInvitation,
  TeamInvitationRepository,
  UpdateTeamInvitationInput,
} from "@/lib/services/onboarding/invitationTypes";

function buildUpdateOperation(patch: UpdateTeamInvitationInput): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) set[key] = value;
  }
  return { $set: set };
}

export const mongodbTeamInvitationRepository: TeamInvitationRepository = {
  async findById(id: string): Promise<TeamInvitation | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await TeamInvitationModel.findById(id).exec();
    return doc ? toTeamInvitation(doc) : null;
  },

  async findByTokenHash(tokenHash: string): Promise<TeamInvitation | null> {
    await getConnection();
    const doc = await TeamInvitationModel.findOne({ tokenHash }).exec();
    return doc ? toTeamInvitation(doc) : null;
  },

  async findPendingByOrganizationAndEmail(organizationId: string, email: string): Promise<TeamInvitation | null> {
    await getConnection();
    const doc = await TeamInvitationModel.findOne({
      organizationId,
      email: email.toLowerCase(),
      status: "pending",
    }).exec();
    return doc ? toTeamInvitation(doc) : null;
  },

  async create(input: CreateTeamInvitationInput): Promise<TeamInvitation> {
    await getConnection();
    const doc = await TeamInvitationModel.create({ ...input, email: input.email.toLowerCase() });
    return toTeamInvitation(doc);
  },

  async update(id: string, patch: UpdateTeamInvitationInput): Promise<TeamInvitation> {
    await getConnection();
    const doc = await TeamInvitationModel.findByIdAndUpdate(id, buildUpdateOperation(patch), { new: true }).exec();
    if (!doc) throw new Error(`TeamInvitation ${id} not found`);
    return toTeamInvitation(doc);
  },

  async listByOrganization(organizationId: string, page: number, limit: number): Promise<PaginatedResult<TeamInvitation>> {
    await getConnection();
    const query = { organizationId };
    const [docs, total] = await Promise.all([
      TeamInvitationModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      TeamInvitationModel.countDocuments(query).exec(),
    ]);
    return buildPaginatedResult(docs.map(toTeamInvitation), total, { page, limit });
  },

  async countPendingByOrganization(organizationId: string): Promise<number> {
    await getConnection();
    return TeamInvitationModel.countDocuments({ organizationId, status: "pending" }).exec();
  },
};
