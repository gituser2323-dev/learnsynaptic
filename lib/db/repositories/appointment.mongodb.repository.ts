import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { AppointmentModel, toAppointment } from "@/lib/db/models/appointment.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  Appointment,
  AppointmentListFilters,
  AppointmentRepository,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@/lib/services/crm/appointments/types";

export const mongodbAppointmentRepository: AppointmentRepository = {
  async findById(id: string): Promise<Appointment | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await AppointmentModel.findById(id).exec();
    return doc ? toAppointment(doc) : null;
  },

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    await getConnection();
    try {
      const doc = await AppointmentModel.create({ ...input, status: "scheduled" });
      return toAppointment(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("Appointment", { assignedCounsellorId: input.assignedCounsellorId, startAt: input.startAt });
      }
      throw error;
    }
  },

  async update(id: string, input: UpdateAppointmentInput): Promise<Appointment> {
    await getConnection();
    const doc = await AppointmentModel.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true }).exec();
    if (!doc) throw new Error(`Appointment ${id} not found`);
    return toAppointment(doc);
  },

  async list(filters: AppointmentListFilters, page: number, limit: number): Promise<PaginatedResult<Appointment>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.leadId) query.leadId = filters.leadId;
    if (filters.appointmentTypeId) query.appointmentTypeId = filters.appointmentTypeId;
    if (filters.assignedCounsellorId) query.assignedCounsellorId = filters.assignedCounsellorId;
    if (filters.status) query.status = filters.status;

    const total = await AppointmentModel.countDocuments(query).exec();
    const docs = await AppointmentModel.find(query)
      .sort({ startAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    return buildPaginatedResult(docs.map(toAppointment), total, { page, limit });
  },

  // No skipTenantScope here — unlike findByPublicSlug/findByPublicSlug-
  // style lookups, this is only ever called from inside
  // publicBookingService/appointmentService AFTER a real tenant context
  // is already established for the resolved AppointmentType's own
  // organization (see runWithTenantContext at each call site), so the
  // normal tenantScopePlugin filtering is exactly what's wanted — one
  // more real narrowing on top of the assignedCounsellorId filter, not a
  // redundant one to bypass.
  async findActiveForCounsellorInRange(assignedCounsellorId: string, rangeStart: string, rangeEnd: string): Promise<Appointment[]> {
    await getConnection();
    const docs = await AppointmentModel.find({
      assignedCounsellorId,
      status: { $ne: "cancelled" },
      startAt: { $lt: new Date(rangeEnd) },
      endAt: { $gt: new Date(rangeStart) },
    }).exec();
    return docs.map(toAppointment);
  },
};
