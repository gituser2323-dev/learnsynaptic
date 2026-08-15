import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Appointment, AppointmentStatus } from "@/lib/services/crm/appointments/types";

export interface AppointmentDocument extends Document {
  organizationId?: Types.ObjectId;
  leadId: Types.ObjectId;
  appointmentTypeId: Types.ObjectId;
  assignedCounsellorId: Types.ObjectId;
  startAt: Date;
  endAt: Date;
  timezone: string;
  status: AppointmentStatus;
  source: string;
  notes?: string;
  meetingId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<AppointmentDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    appointmentTypeId: { type: Schema.Types.ObjectId, ref: "AppointmentType", required: true, index: true },
    assignedCounsellorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true },
    status: { type: String, enum: ["scheduled", "confirmed", "completed", "cancelled", "no_show"], required: true, index: true },
    source: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    meetingId: { type: String },
  },
  { timestamps: true },
);

// The double-booking guard: only one non-cancelled Appointment may ever
// occupy a given (assignedCounsellorId, startAt) pair. Every appointment
// of one AppointmentType shares that type's own fixed durationMinutes, so
// an identical startAt for the same counsellor IS an identical, fully
// overlapping slot — this index catches the mission's own literal hard
// requirement ("two requests for the exact same slot — only one
// succeeds") atomically, with no transaction/replica-set dependency. The
// same unique+partialFilterExpression shape already used by
// conversation.model.ts (contact uniqueness) and
// paymentWebhookEvent.model.ts (provider-event dedup) — an established
// idiom here, not a novel one. Cross-AppointmentType overlap (different
// durations, overlapping-but-not-identical start times) is deliberately
// NOT locked here — see publicBookingService.getAvailability's own doc
// comment for why read-time exclusion is the accepted MVP mitigation.
appointmentSchema.index(
  { assignedCounsellorId: 1, startAt: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: "cancelled" } } },
);

// The Lead Detail page's own "Appointments" section query, and the
// availability/overlap-exclusion range query — mirrors meeting.model.ts's
// own index comment for the identical read shape.
appointmentSchema.index({ leadId: 1, startAt: -1 });

appointmentSchema.plugin(tenantScopePlugin);

export function toAppointment(doc: AppointmentDocument): Appointment {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId?.toString(),
    leadId: doc.leadId.toString(),
    appointmentTypeId: doc.appointmentTypeId.toString(),
    assignedCounsellorId: doc.assignedCounsellorId.toString(),
    startAt: doc.startAt.toISOString(),
    endAt: doc.endAt.toISOString(),
    timezone: doc.timezone,
    status: doc.status,
    source: doc.source,
    notes: doc.notes,
    meetingId: doc.meetingId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const AppointmentModel: Model<AppointmentDocument> =
  (models.Appointment as Model<AppointmentDocument>) || model<AppointmentDocument>("Appointment", appointmentSchema);
