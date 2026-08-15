import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { AppointmentType, WeeklyAvailabilitySlot } from "@/lib/services/crm/appointments/types";

const weeklyAvailabilitySlotSchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startMinute: { type: Number, required: true, min: 0, max: 1440 },
    endMinute: { type: Number, required: true, min: 0, max: 1440 },
  },
  { _id: false },
);

export interface AppointmentTypeDocument extends Document {
  organizationId?: Types.ObjectId;
  name: string;
  description?: string;
  publicSlug: string;
  durationMinutes: number;
  bufferMinutes: number;
  timezone: string;
  weeklyAvailability: WeeklyAvailabilitySlot[];
  assignedCounsellorId: Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentTypeSchema = new Schema<AppointmentTypeDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    // Globally unique, not compound with organizationId — same reasoning
    // as LeadCaptureForm.publicSlug's own doc comment: the public URL
    // (/book/{slug}) carries no org prefix, so two organizations picking
    // the same slug would be genuinely ambiguous, not just a same-tenant
    // collision.
    publicSlug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 480 },
    bufferMinutes: { type: Number, required: true, default: 0, min: 0, max: 240 },
    timezone: { type: String, required: true, trim: true },
    weeklyAvailability: { type: [weeklyAvailabilitySlotSchema], default: [] },
    assignedCounsellorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

appointmentTypeSchema.plugin(tenantScopePlugin);

export function toAppointmentType(doc: AppointmentTypeDocument): AppointmentType {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId?.toString(),
    name: doc.name,
    description: doc.description,
    publicSlug: doc.publicSlug,
    durationMinutes: doc.durationMinutes,
    bufferMinutes: doc.bufferMinutes,
    timezone: doc.timezone,
    weeklyAvailability: doc.weeklyAvailability,
    assignedCounsellorId: doc.assignedCounsellorId.toString(),
    active: doc.active,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const AppointmentTypeModel: Model<AppointmentTypeDocument> =
  (models.AppointmentType as Model<AppointmentTypeDocument>) ||
  model<AppointmentTypeDocument>("AppointmentType", appointmentTypeSchema);
