import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { LeadCaptureFormModel, toLeadCaptureForm } from "@/lib/db/models/leadCaptureForm.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type {
  CreateLeadCaptureFormInput,
  LeadCaptureForm,
  LeadCaptureFormRepository,
  UpdateLeadCaptureFormInput,
} from "@/lib/services/crm/leadCaptureForms/types";

export const mongodbLeadCaptureFormRepository: LeadCaptureFormRepository = {
  async findById(id: string): Promise<LeadCaptureForm | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await LeadCaptureFormModel.findById(id).exec();
    return doc ? toLeadCaptureForm(doc) : null;
  },

  // Deliberately passes skipTenantScope — the same escape hatch
  // phoneNumber.mongodb.repository.ts's own findByPhoneNumberId uses for
  // the identical "discover the org, don't assume it" reason (see that
  // file's own doc comment and this repository's own interface doc).
  async findByPublicSlug(slug: string): Promise<LeadCaptureForm | null> {
    await getConnection();
    const doc = await LeadCaptureFormModel.findOne({ publicSlug: slug }).setOptions({ skipTenantScope: true }).exec();
    return doc ? toLeadCaptureForm(doc) : null;
  },

  async create(input: CreateLeadCaptureFormInput & { publicSlug: string }): Promise<LeadCaptureForm> {
    await getConnection();
    try {
      const doc = await LeadCaptureFormModel.create({
        ...input,
        active: true,
        submissionCount: 0,
        duplicateCount: 0,
      });
      return toLeadCaptureForm(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("LeadCaptureForm", { publicSlug: input.publicSlug });
      }
      throw error;
    }
  },

  async list(): Promise<LeadCaptureForm[]> {
    await getConnection();
    const docs = await LeadCaptureFormModel.find().sort({ createdAt: -1 }).exec();
    return docs.map(toLeadCaptureForm);
  },

  async update(id: string, input: UpdateLeadCaptureFormInput): Promise<LeadCaptureForm> {
    await getConnection();
    const doc = await LeadCaptureFormModel.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    if (!doc) throw new Error(`LeadCaptureForm ${id} not found`);
    return toLeadCaptureForm(doc);
  },

  async delete(id: string): Promise<void> {
    await getConnection();
    await LeadCaptureFormModel.deleteOne({ _id: id }).exec();
  },

  async incrementCounts(id: string, options: { duplicate: boolean }): Promise<void> {
    await getConnection();
    await LeadCaptureFormModel.updateOne(
      { _id: id },
      { $inc: { submissionCount: 1, duplicateCount: options.duplicate ? 1 : 0 } },
    ).exec();
  },
};
