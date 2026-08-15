import mongoose from "mongoose";
import { describe, it, expect } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { subscribe } from "@/lib/events";
import type { DomainEvent } from "@/lib/events";
import { appointmentTypeService } from "./appointmentTypeService";
import { publicBookingService } from "./publicBookingService";
import { appointmentService } from "./appointmentService";
import { activityService } from "@/lib/services/crm/activities";
import type { WeeklyAvailabilitySlot } from "./types";

function uniqueOrg(label: string): string {
  return `org-apsvc-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fakeCounsellorId(): string {
  return new mongoose.Types.ObjectId().toHexString();
}

const ALL_DAY_EVERY_DAY: WeeklyAvailabilitySlot[] = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek: dayOfWeek as WeeklyAvailabilitySlot["dayOfWeek"],
  startMinute: 0,
  endMinute: 1440,
}));

function tomorrowDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Books a real appointment through the real public flow (not a direct
 *  repository insert) — so this file's own tests exercise
 *  appointmentService against the exact same data shape production
 *  traffic produces. */
async function bookTestAppointment(organizationId: string) {
  const typeResult = await runWithTenantContext({ organizationId }, () =>
    appointmentTypeService.createAppointmentType({
      name: "Test Type",
      durationMinutes: 30,
      bufferMinutes: 0,
      timezone: "Asia/Kolkata",
      weeklyAvailability: ALL_DAY_EVERY_DAY,
      assignedCounsellorId: fakeCounsellorId(),
    }),
  );
  if (!typeResult.success) throw new Error("seed type failed");
  const type = typeResult.appointmentType;

  const availability = await publicBookingService.getAvailability(type.publicSlug, tomorrowDateString());
  if (!availability || availability.slots.length === 0) throw new Error("expected an available slot tomorrow");

  const bookingResult = await publicBookingService.book(type.publicSlug, {
    startAt: availability.slots[0],
    timezone: type.timezone,
    name: "Test Customer",
    email: `test-customer-${Date.now()}@example.com`,
    phone: "+919876500099",
  });
  if (!bookingResult.success) throw new Error(`seed booking failed: ${JSON.stringify(bookingResult)}`);

  const { getAppointmentRepository } = await import("@/lib/db");
  const appointments = await runWithTenantContext({ organizationId }, async () => {
    const repository = await getAppointmentRepository();
    return repository.list({}, 1, 1);
  });
  return { type, appointment: appointments.items[0] };
}

describe("appointmentService.updateStatus", () => {
  it("confirming an appointment publishes appointment.confirmed with the leadId, and logs a Lead Activity Timeline entry", async () => {
    const org = uniqueOrg("confirm");
    const { appointment } = await bookTestAppointment(org);

    const seen: DomainEvent[] = [];
    subscribe("appointment.confirmed", async (event) => {
      seen.push(event as DomainEvent);
    });

    const result = await runWithTenantContext({ organizationId: org }, () => appointmentService.updateStatus(appointment.id, "confirmed", undefined));
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.appointment.status).toBe("confirmed");

    const published = seen.find((e) => (e.payload as { appointmentId?: string }).appointmentId === appointment.id);
    expect(published).toBeDefined();
    expect((published!.payload as { leadId?: string }).leadId).toBe(appointment.leadId);

    const timeline = await runWithTenantContext({ organizationId: org }, () => activityService.listTimeline({ entityType: "Lead", entityId: appointment.leadId }, 1, 20));
    expect(timeline.items.some((a) => a.body.includes("Appointment confirmed"))).toBe(true);
  });

  it("cancelling an appointment publishes appointment.cancelled and logs a distinct Activity entry", async () => {
    const org = uniqueOrg("cancel");
    const { appointment } = await bookTestAppointment(org);

    const seen: DomainEvent[] = [];
    subscribe("appointment.cancelled", async (event) => {
      seen.push(event as DomainEvent);
    });

    const result = await runWithTenantContext({ organizationId: org }, () => appointmentService.updateStatus(appointment.id, "cancelled", undefined));
    expect(result.success).toBe(true);

    expect(seen.some((e) => (e.payload as { appointmentId?: string }).appointmentId === appointment.id)).toBe(true);

    const timeline = await runWithTenantContext({ organizationId: org }, () => activityService.listTimeline({ entityType: "Lead", entityId: appointment.leadId }, 1, 20));
    expect(timeline.items.some((a) => a.body.includes("Appointment cancelled"))).toBe(true);
  });

  it("a notes-only edit (status unchanged) updates notes but does NOT re-publish an event or re-log an Activity entry", async () => {
    const org = uniqueOrg("notes-only");
    const { appointment } = await bookTestAppointment(org);

    // "scheduled" has no STATUS_EVENTS entry at all (see
    // appointmentService.ts's own doc comment) and the booking itself
    // already logged one "Appointment booked" entry — the real
    // assertion here is that calling updateStatus with the SAME status
    // again (a notes-only edit from the admin UI) doesn't add a second
    // "Appointment booked" entry on top of that.
    const before = await runWithTenantContext({ organizationId: org }, () => activityService.listTimeline({ entityType: "Lead", entityId: appointment.leadId }, 1, 20));
    const beforeCount = before.items.filter((a) => a.body.includes("Appointment booked")).length;

    const result = await runWithTenantContext({ organizationId: org }, () => appointmentService.updateStatus(appointment.id, "scheduled", "Customer called to ask about parking."));
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.appointment.notes).toBe("Customer called to ask about parking.");

    const after = await runWithTenantContext({ organizationId: org }, () => activityService.listTimeline({ entityType: "Lead", entityId: appointment.leadId }, 1, 20));
    const afterCount = after.items.filter((a) => a.body.includes("Appointment booked")).length;
    expect(afterCount).toBe(beforeCount);
  });
});
