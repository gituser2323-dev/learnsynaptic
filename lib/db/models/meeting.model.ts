import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { CalendarProviderId, Meeting, MeetingInvitee, MeetingStatus, MeetingSyncStatus } from "@/lib/services/calendar/types";

export interface MeetingDocument extends Document {
  provider: CalendarProviderId;
  externalEventId?: string;
  calendarId?: string;
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  meetingLink?: string;
  status: MeetingStatus;
  invitees: MeetingInvitee[];
  reminderMinutesBefore?: number;
  reminderSentAt?: Date;
  syncStatus: MeetingSyncStatus;
  lastSyncError?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdBy?: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const meetingInviteeSchema = new Schema<MeetingInvitee>(
  {
    email: { type: String, required: true },
    name: { type: String },
    responseStatus: { type: String, enum: ["needsAction", "accepted", "declined", "tentative"] },
  },
  { _id: false },
);

const meetingSchema = new Schema<MeetingDocument>(
  {
    provider: {
      type: String,
      enum: ["google_calendar", "google_meet", "microsoft_outlook_calendar", "microsoft_teams_meetings", "zoom"],
      required: true,
      index: true,
    },
    externalEventId: { type: String },
    calendarId: { type: String },
    title: { type: String, required: true },
    description: { type: String },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true },
    meetingLink: { type: String },
    status: { type: String, enum: ["scheduled", "confirmed", "cancelled", "completed"], required: true, index: true },
    invitees: { type: [meetingInviteeSchema], default: [] },
    reminderMinutesBefore: { type: Number },
    reminderSentAt: { type: Date },
    syncStatus: { type: String, enum: ["synced", "pending", "failed"], required: true },
    lastSyncError: { type: String },
    // Deliberately plain strings, not an enum — mirrors FileAsset's own
    // doc comment exactly: Meeting must stay reusable by CRM entities
    // (and future Student Portal/LMS bookings) that don't exist yet.
    relatedEntityType: { type: String, index: true },
    relatedEntityId: { type: String, index: true },
    createdBy: { type: String },
    organizationId: { type: String, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

// The Lead-meetings read pattern: every meeting for one entity, newest
// first, soft-deleted rows excluded by the repository.
meetingSchema.index({ relatedEntityType: 1, relatedEntityId: 1, startAt: -1 });
// The reminder poller's own query.
meetingSchema.index({ status: 1, reminderMinutesBefore: 1, reminderSentAt: 1, startAt: 1 });

meetingSchema.plugin(tenantScopePlugin);

export function toMeeting(doc: MeetingDocument): Meeting {
  return {
    id: doc._id.toString(),
    provider: doc.provider,
    externalEventId: doc.externalEventId,
    calendarId: doc.calendarId,
    title: doc.title,
    description: doc.description,
    startAt: doc.startAt.toISOString(),
    endAt: doc.endAt.toISOString(),
    timezone: doc.timezone,
    meetingLink: doc.meetingLink,
    status: doc.status,
    invitees: doc.invitees,
    reminderMinutesBefore: doc.reminderMinutesBefore,
    reminderSentAt: doc.reminderSentAt?.toISOString(),
    syncStatus: doc.syncStatus,
    lastSyncError: doc.lastSyncError,
    relatedEntityType: doc.relatedEntityType,
    relatedEntityId: doc.relatedEntityId,
    createdBy: doc.createdBy,
    organizationId: doc.organizationId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    deletedAt: doc.deletedAt?.toISOString(),
  };
}

export const MeetingModel: Model<MeetingDocument> = (models.Meeting as Model<MeetingDocument>) || model<MeetingDocument>("Meeting", meetingSchema);
