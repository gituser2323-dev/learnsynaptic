import mongoose from "mongoose";
import { describe, it, expect } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { appointmentTypeService } from "./appointmentTypeService";
import { publicBookingService } from "./publicBookingService";
import { leadService } from "@/lib/services/leads";
import type { WeeklyAvailabilitySlot } from "./types";

function uniqueOrg(label: string): string {
  return `org-pbs-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fakeCounsellorId(): string {
  return new mongoose.Types.ObjectId().toHexString();
}

// All 7 days, effectively all day — makes "tomorrow" always have real,
// deterministic availability regardless of which day-of-week the test
// actually runs on, avoiding any "what if this runs on a Sunday"
// flakiness a Mon–Fri fixture would risk.
const ALL_DAY_EVERY_DAY: WeeklyAvailabilitySlot[] = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek: dayOfWeek as WeeklyAvailabilitySlot["dayOfWeek"],
  startMinute: 0,
  endMinute: 1440,
}));

async function createTestType(organizationId: string, overrides: Record<string, unknown> = {}) {
  const result = await runWithTenantContext({ organizationId }, () =>
    appointmentTypeService.createAppointmentType({
      name: "Free Counselling Call",
      durationMinutes: 30,
      bufferMinutes: 0,
      timezone: "Asia/Kolkata",
      weeklyAvailability: ALL_DAY_EVERY_DAY,
      assignedCounsellorId: fakeCounsellorId(),
      ...overrides,
    }),
  );
  if (!result.success) throw new Error(`seed appointment type creation failed: ${JSON.stringify(result.errors)}`);
  return result.appointmentType;
}

function tomorrowDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Fetches a real, currently-open slot for tomorrow the same way a real
 *  client would (GET availability, then book one of the returned
 *  slots) — never hand-computed, so this test can never drift out of
 *  sync with computeAvailableSlots's own real logic. */
async function firstAvailableSlotTomorrow(slug: string): Promise<string> {
  const result = await publicBookingService.getAvailability(slug, tomorrowDateString());
  if (!result || result.slots.length === 0) throw new Error("expected at least one available slot tomorrow");
  return result.slots[0];
}

describe("publicBookingService.book — the real CRM lifecycle, unmodified", () => {
  it("a valid booking creates a real Lead with source=appointment_booking and a scheduled Appointment, reachable with NO ambient tenant context, same as the real public route", async () => {
    const org = uniqueOrg("valid");
    const type = await createTestType(org);
    const slot = await firstAvailableSlotTomorrow(type.publicSlug);

    // Deliberately NOT wrapped in runWithTenantContext — the real public
    // route has no session/context at all; book() must resolve and
    // establish it internally from the slug alone.
    const result = await publicBookingService.book(type.publicSlug, {
      startAt: slot,
      timezone: type.timezone,
      name: "Asha Kumar",
      email: "asha@example.com",
      phone: "+919876543210",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.duplicate).toBe(false);

    const leads = await runWithTenantContext({ organizationId: org }, () => leadService.listLeads({}, 1, 20));
    expect(leads.items).toHaveLength(1);
    expect(leads.items[0].source).toBe("appointment_booking");

    const { getAppointmentRepository } = await import("@/lib/db");
    const appointments = await runWithTenantContext({ organizationId: org }, async () => {
      const repository = await getAppointmentRepository();
      return repository.list({}, 1, 20);
    });
    expect(appointments.items).toHaveLength(1);
    expect(appointments.items[0].status).toBe("scheduled");
    expect(appointments.items[0].leadId).toBe(leads.items[0].id);
    // No calendar provider is ever connected in this test environment
    // (never configured — same disclosed reality the rest of this
    // codebase's own Calendar module audit already carries) — the
    // booking must still succeed, with meetingId simply left unset.
    expect(appointments.items[0].meetingId).toBeUndefined();
  });

  it("a repeat booking (same phone/email) attaches to the SAME Lead — recognized as a duplicate touch, never a second Lead", async () => {
    const org = uniqueOrg("duplicate");
    const type = await createTestType(org);
    const contact = { name: "Rohit Verma", email: "rohit@example.com", phone: "+919876500000" };

    const slot1 = await firstAvailableSlotTomorrow(type.publicSlug);
    const first = await publicBookingService.book(type.publicSlug, { startAt: slot1, timezone: type.timezone, ...contact });
    expect(first.success && !first.duplicate).toBe(true);

    // A second, different slot — this is the real behavior an existing
    // customer booking again from the public page produces, not a
    // simultaneous double-booking of the identical slot (see the race
    // test below for that case).
    const slot2 = (await publicBookingService.getAvailability(type.publicSlug, tomorrowDateString()))!.slots.find((s) => s !== slot1);
    if (!slot2) throw new Error("expected a second distinct slot tomorrow");
    const second = await publicBookingService.book(type.publicSlug, { startAt: slot2, timezone: type.timezone, ...contact });
    expect(second.success).toBe(true);
    if (!second.success) throw new Error("expected success");
    expect(second.duplicate).toBe(true);

    const leads = await runWithTenantContext({ organizationId: org }, () => leadService.listLeads({}, 1, 20));
    expect(leads.items).toHaveLength(1);
  });

  it("an inactive AppointmentType's booking endpoint rejects with 404, not a silent drop", async () => {
    const org = uniqueOrg("inactive");
    const type = await createTestType(org);
    await runWithTenantContext({ organizationId: org }, () => appointmentTypeService.updateAppointmentType(type.id, { active: false }));

    const result = await publicBookingService.book(type.publicSlug, {
      startAt: new Date(Date.now() + 86_400_000).toISOString(),
      timezone: type.timezone,
      name: "Someone",
      email: "someone@example.com",
      phone: "+919876500001",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.status).toBe(404);
  });

  it("an unknown slug returns 404 and establishes no tenant context (no cross-tenant leak surface)", async () => {
    const result = await publicBookingService.book("this-slug-does-not-exist", {
      startAt: new Date(Date.now() + 86_400_000).toISOString(),
      timezone: "Asia/Kolkata",
      name: "Someone",
      email: "someone@example.com",
      phone: "+919876500002",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.status).toBe(404);
  });

  it("a filled honeypot field is silently accepted but never reaches the CRM", async () => {
    const org = uniqueOrg("honeypot");
    const type = await createTestType(org);
    const slot = await firstAvailableSlotTomorrow(type.publicSlug);

    const result = await publicBookingService.book(type.publicSlug, {
      startAt: slot,
      timezone: type.timezone,
      name: "Bot",
      email: "bot@example.com",
      phone: "+919876500003",
      website: "http://spam.example.com",
    });
    expect(result.success).toBe(true);

    const leads = await runWithTenantContext({ organizationId: org }, () => leadService.listLeads({}, 1, 20));
    expect(leads.items).toHaveLength(0);
  });

  it("rejects a startAt outside the computed availability with 400, rather than trusting a stale client-side slot list", async () => {
    const org = uniqueOrg("stale-slot");
    const type = await createTestType(org);

    // A time already in the past is never in computeAvailableSlots's own
    // output regardless of weeklyAvailability — a deterministic way to
    // exercise the re-verification path without needing a slot outside
    // working hours.
    const result = await publicBookingService.book(type.publicSlug, {
      startAt: new Date(Date.now() - 86_400_000).toISOString(),
      timezone: type.timezone,
      name: "Someone",
      email: "someone@example.com",
      phone: "+919876500004",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.status).toBe(400);
  });

  it("double-booking race: two concurrent bookings for the exact same slot — only one succeeds, the other gets a 409", async () => {
    const org = uniqueOrg("race");
    const type = await createTestType(org);
    const slot = await firstAvailableSlotTomorrow(type.publicSlug);

    const [a, b] = await Promise.all([
      publicBookingService.book(type.publicSlug, { startAt: slot, timezone: type.timezone, name: "Customer A", email: "customer-a@example.com", phone: "+919876500005" }),
      publicBookingService.book(type.publicSlug, { startAt: slot, timezone: type.timezone, name: "Customer B", email: "customer-b@example.com", phone: "+919876500006" }),
    ]);

    const results = [a, b];
    const successes = results.filter((r) => r.success);
    const conflicts = results.filter((r) => !r.success && r.status === 409);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);

    const { getAppointmentRepository } = await import("@/lib/db");
    const appointments = await runWithTenantContext({ organizationId: org }, async () => {
      const repository = await getAppointmentRepository();
      return repository.list({}, 1, 20);
    });
    expect(appointments.items).toHaveLength(1);
  });

  it("a booking missing a required contact field surfaces leadService's own validation errors as a 400, and creates neither a Lead nor an Appointment", async () => {
    const org = uniqueOrg("invalid-contact");
    const type = await createTestType(org);
    const slot = await firstAvailableSlotTomorrow(type.publicSlug);

    // email is required by leadService.registerLead's own validation
    // (the same requirement PublicLeadCaptureForm's own form already
    // has) — this exercises book()'s own delegation to that existing
    // validation, not a duplicate check of its own.
    const result = await publicBookingService.book(type.publicSlug, {
      startAt: slot,
      timezone: type.timezone,
      name: "No Email Customer",
      phone: "+919876500007",
    });
    expect(result.success).toBe(false);
    if (result.success || result.status !== 400) throw new Error("expected a 400 validation failure");
    expect(result.errors?.some((e) => e.field === "email")).toBe(true);

    const leads = await runWithTenantContext({ organizationId: org }, () => leadService.listLeads({}, 1, 20));
    expect(leads.items).toHaveLength(0);
  });
});

describe("publicBookingService — tenant isolation", () => {
  it("Org B cannot book against Org A's AppointmentType via Org A's slug resolving to Org B's data", async () => {
    const orgA = uniqueOrg("iso-a");
    const orgB = uniqueOrg("iso-b");
    const typeA = await createTestType(orgA, { name: "Org A Type" });
    const slot = await firstAvailableSlotTomorrow(typeA.publicSlug);

    const result = await publicBookingService.book(typeA.publicSlug, {
      startAt: slot,
      timezone: typeA.timezone,
      name: "Cross Tenant Customer",
      email: "cross@example.com",
      phone: "+919876500008",
    });
    expect(result.success).toBe(true);

    const leadsInOrgB = await runWithTenantContext({ organizationId: orgB }, () => leadService.listLeads({}, 1, 20));
    expect(leadsInOrgB.items).toHaveLength(0);

    const leadsInOrgA = await runWithTenantContext({ organizationId: orgA }, () => leadService.listLeads({}, 1, 20));
    expect(leadsInOrgA.items).toHaveLength(1);
  });
});
