import { calendarService, isCalendarProviderId } from "@/lib/services/calendar";
import type { WorkflowActionExecutor } from "../types";

/**
 * Calendar & Meeting Connectors (Phase 6), Module 6.3 — the one
 * workflow action this module adds, the same create_task-style
 * param-driven shape (a meeting needs a title/duration/provider a
 * trigger's own context can't infer). Resolves the invitee from
 * `context.data.email`/`context.data.name`, the exact convention
 * sendEmail.ts's own `recipientFromContext()` already established for
 * "the Lead this workflow is running for, as an email recipient."
 *
 * Deliberately does NOT invent new automation logic beyond this single
 * integration point — no new trigger types, no reminder/follow-up
 * scheduling logic beyond what calendarService.scheduleMeeting() (its
 * own reminderMinutesBefore/createFollowUpTask params) already
 * provides for a manual schedule. A step using this action gets
 * exactly the same Reminder Support and optional follow-up Task
 * creation a counsellor scheduling a meeting by hand already gets —
 * one code path, not two.
 */
export const scheduleMeeting: WorkflowActionExecutor = async (context, params) => {
  const provider = typeof params.provider === "string" && isCalendarProviderId(params.provider) ? params.provider : undefined;
  if (!provider) throw new Error("schedule_meeting action requires a valid provider param.");

  const title = typeof params.title === "string" ? params.title : "";
  if (!title) throw new Error("schedule_meeting action requires a title param.");

  const durationMinutes = typeof params.durationMinutes === "number" && params.durationMinutes > 0 ? params.durationMinutes : 30;
  const startInMinutes = typeof params.startInMinutes === "number" && params.startInMinutes >= 0 ? params.startInMinutes : 60;

  const email = String(context.data.email ?? "");
  if (!email) throw new Error("schedule_meeting action requires a lead email address in workflow context data.");
  const name = typeof context.data.name === "string" ? context.data.name : undefined;

  const startAt = new Date(Date.now() + startInMinutes * 60_000);
  const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

  const result = await calendarService.scheduleMeeting({
    provider,
    title,
    description: typeof params.description === "string" ? params.description : undefined,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    timezone: typeof params.timezone === "string" && params.timezone ? params.timezone : "Asia/Kolkata",
    invitees: [{ email, name }],
    reminderMinutesBefore: typeof params.reminderMinutesBefore === "number" ? params.reminderMinutesBefore : 30,
    relatedEntityType: context.entityType === "Lead" ? "Lead" : undefined,
    relatedEntityId: context.entityType === "Lead" ? context.entityId : undefined,
  });

  if (!result.success) {
    throw new Error(`schedule_meeting action failed validation: ${result.errors.map((e) => e.message).join(", ")}`);
  }
};
