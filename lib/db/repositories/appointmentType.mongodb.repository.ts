import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { AppointmentTypeModel, toAppointmentType } from "@/lib/db/models/appointmentType.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type {
  AppointmentTypeRepository,
  CreateAppointmentTypeInput,
  AppointmentType,
  UpdateAppointmentTypeInput,
} from "@/lib/services/crm/appointments/types";

export const mongodbAppointmentTypeRepository: AppointmentTypeRepository = {
  async findById(id: string): Promise<AppointmentType | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await AppointmentTypeModel.findById(id).exec();
    return doc ? toAppointmentType(doc) : null;
  },

  // Deliberately passes skipTenantScope — the same escape hatch
  // leadCaptureForm.mongodb.repository.ts's own findByPublicSlug uses for
  // the identical "discover the org, don't assume it" reason.
  async findByPublicSlug(slug: string): Promise<AppointmentType | null> {
    await getConnection();
    const doc = await AppointmentTypeModel.findOne({ publicSlug: slug }).setOptions({ skipTenantScope: true }).exec();
    return doc ? toAppointmentType(doc) : null;
  },

  async create(input: CreateAppointmentTypeInput & { publicSlug: string }): Promise<AppointmentType> {
    await getConnection();
    try {
      const doc = await AppointmentTypeModel.create({ ...input, active: true });
      return toAppointmentType(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("AppointmentType", { publicSlug: input.publicSlug });
      }
      throw error;
    }
  },

  async list(): Promise<AppointmentType[]> {
    await getConnection();
    const docs = await AppointmentTypeModel.find().sort({ createdAt: -1 }).exec();
    return docs.map(toAppointmentType);
  },

  async update(id: string, input: UpdateAppointmentTypeInput): Promise<AppointmentType> {
    await getConnection();
    const doc = await AppointmentTypeModel.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    if (!doc) throw new Error(`AppointmentType ${id} not found`);
    return toAppointmentType(doc);
  },

  async delete(id: string): Promise<void> {
    await getConnection();
    await AppointmentTypeModel.deleteOne({ _id: id }).exec();
  },
};
