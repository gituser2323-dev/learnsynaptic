import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Attendance } from "@/lib/services/attendance/types";

export interface AttendanceDocument extends Document {
  registrationId: Types.ObjectId;
  sessionLabel: string;
  sessionDate: Date;
  present: boolean;
  markedAt: Date;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<AttendanceDocument>(
  {
    registrationId: { type: Schema.Types.ObjectId, ref: "Registration", required: true },
    sessionLabel: { type: String, required: true, trim: true },
    sessionDate: { type: Date, required: true },
    present: { type: Boolean, required: true },
    markedAt: { type: Date, default: Date.now },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// "All attendance for this registration" — the primary admin view.
attendanceSchema.index({ registrationId: 1, sessionDate: -1 });

attendanceSchema.plugin(tenantScopePlugin);

export function toAttendance(doc: AttendanceDocument): Attendance {
  return {
    id: doc._id.toString(),
    registrationId: doc.registrationId.toString(),
    sessionLabel: doc.sessionLabel,
    sessionDate: doc.sessionDate.toISOString(),
    present: doc.present,
    markedAt: doc.markedAt.toISOString(),
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const AttendanceModel: Model<AttendanceDocument> =
  (models.Attendance as Model<AttendanceDocument>) || model<AttendanceDocument>("Attendance", attendanceSchema);
