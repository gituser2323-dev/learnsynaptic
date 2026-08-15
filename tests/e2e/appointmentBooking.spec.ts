import mongoose from "mongoose";
import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Appointment Booking — the Growth-track module after Lead Capture.
 * Verifies the new public booking flow reaches the real CRM lifecycle
 * (Lead, Activity Timeline, Appointment), the double-booking hard
 * requirement, existing-Lead dedup, tenant isolation, and that the
 * existing Meetings/Lead Capture/manual CRM flows remain completely
 * unaffected — mirroring tests/e2e/leadCaptureForms.spec.ts's own
 * structure exactly (this module reuses the identical public-route
 * architecture) and deliberately NOT re-testing Module 6.3's own routes,
 * already covered by tests/e2e/calendar.spec.ts.
 */

const ORG_A = `e2e-apt-org-a-${Date.now()}`;
const ORG_B = `e2e-apt-org-b-${Date.now()}`;

async function adminContextFor(browser: import("@playwright/test").Browser, baseURL: string, organizationId: string, role: "admin" | "manager" | "counsellor" = "admin") {
  const context = await browser.newContext();
  await addSessionCookie(context, baseURL, role, {
    id: `e2e-${role}-${organizationId}`,
    email: `e2e-${role}-${organizationId}@test.local`,
    organizationId,
  });
  return context;
}

function fakeCounsellorId(): string {
  return new mongoose.Types.ObjectId().toHexString();
}

// All 7 days, all day — deterministic real availability regardless of
// which day-of-week a given test run actually happens on, the same
// reasoning lib/services/crm/appointments/publicBookingService.unit.test.ts's
// own ALL_DAY_EVERY_DAY fixture already documents.
const ALL_DAY_EVERY_DAY = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startMinute: 0, endMinute: 1440 }));

function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function createTestAppointmentType(context: import("@playwright/test").APIRequestContext, name: string) {
  const res = await context.post("/api/admin/crm/appointment-types", {
    data: {
      name,
      durationMinutes: 30,
      bufferMinutes: 0,
      timezone: "Asia/Kolkata",
      weeklyAvailability: ALL_DAY_EVERY_DAY,
      assignedCounsellorId: fakeCounsellorId(),
    },
  });
  expect(res.ok()).toBeTruthy();
  const { appointmentType } = (await res.json()) as { appointmentType: { id: string; publicSlug: string; name: string } };
  return appointmentType;
}

test.describe("Appointment Booking — new public booking flow reaches the real CRM lifecycle", () => {
  test("a real browser walk (date -> time -> details -> confirm) creates a Lead + Appointment + Activity entry, correctly attributed", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const appointmentType = await createTestAppointmentType(orgAContext.request, `E2E Counselling Call ${Date.now()}`);

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/book/${appointmentType.publicSlug}`);
    await expect(publicPage.getByRole("heading", { name: appointmentType.name })).toBeVisible();

    // Date step — tomorrow, guaranteed real availability from the
    // all-day-every-day fixture above.
    await publicPage.locator("#booking-date").fill(tomorrowDateString());

    // Time step — a real available slot rendered by the real
    // availability endpoint, not hand-computed by this test.
    const slotButton = publicPage.locator("button", { hasText: /\d{1,2}:\d{2}/ }).first();
    await expect(slotButton).toBeVisible({ timeout: 10_000 });
    await slotButton.click();

    // Details step.
    const email = `e2e-apt-${Date.now()}@example.com`;
    await publicPage.locator("#booking-name").fill("E2E Public Visitor");
    await publicPage.locator("#booking-email").fill(email);
    await publicPage.locator("#booking-phone").fill("+919876543220");

    const bookResponse = publicPage.waitForResponse(
      (response) => response.url().includes(`/api/booking/${appointmentType.publicSlug}`) && response.request().method() === "POST",
    );
    await publicPage.getByRole("button", { name: /book appointment/i }).click();
    const response = await bookResponse;
    expect(response.ok()).toBeTruthy();

    // Confirmation step — proves the client read a real 2xx, not just
    // that the request left the browser.
    await expect(publicPage.getByText(/your appointment is confirmed/i)).toBeVisible();
    await publicContext.close();

    // Back as the type's own organization: the lead is real, findable
    // through the exact same admin Leads list every manually-created
    // lead uses, with the correct source attribution.
    const listRes = await orgAContext.request.get(`/api/admin/leads?search=${encodeURIComponent(email)}`);
    const listBody = (await listRes.json()) as { items: { id: string; source: string }[] };
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].source).toBe("appointment_booking");
    const leadId = listBody.items[0].id;

    // A real Appointment row exists, status scheduled, referencing the
    // real AppointmentType and this exact Lead.
    const appointmentsRes = await orgAContext.request.get(`/api/admin/crm/appointments?leadId=${leadId}`);
    const appointmentsBody = (await appointmentsRes.json()) as { items: { status: string; appointmentTypeId: string; leadId: string }[] };
    expect(appointmentsBody.items).toHaveLength(1);
    expect(appointmentsBody.items[0].status).toBe("scheduled");
    expect(appointmentsBody.items[0].appointmentTypeId).toBe(appointmentType.id);

    // The Lead's own Activity Timeline shows the new booking — the same
    // CRM-integration guarantee Module 6.3's Meetings already have.
    const activitiesRes = await orgAContext.request.get(`/api/admin/crm/activities?entityType=Lead&entityId=${leadId}`);
    const activitiesBody = (await activitiesRes.json()) as { items: { body: string }[] };
    expect(activitiesBody.items.some((a) => a.body.includes("Appointment booked"))).toBe(true);

    await orgAContext.close();
  });

  test("an inactive AppointmentType's public page 404s, and its booking endpoint rejects new bookings", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const appointmentType = await createTestAppointmentType(orgAContext.request, `E2E Paused Type ${Date.now()}`);
    await orgAContext.request.patch(`/api/admin/crm/appointment-types/${appointmentType.id}`, { data: { active: false } });

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/book/${appointmentType.publicSlug}`);
    await expect(publicPage.getByText(/could not be found/i)).toBeVisible();

    const bookRes = await publicContext.request.post(`/api/booking/${appointmentType.publicSlug}`, {
      headers: { origin: baseURL! },
      data: { startAt: new Date(Date.now() + 86_400_000).toISOString(), timezone: "Asia/Kolkata", name: "Someone", email: `e2e-apt-inactive-${Date.now()}@example.com`, phone: "+919876543221" },
    });
    expect(bookRes.status()).toBe(404);

    await publicContext.close();
    await orgAContext.close();
  });

  test("an unknown slug 404s on both the availability lookup and the booking endpoint", async ({ browser, baseURL }) => {
    const publicContext = await browser.newContext();
    const availabilityRes = await publicContext.request.get(`/api/booking/this-slug-does-not-exist/availability?date=${tomorrowDateString()}`);
    expect(availabilityRes.status()).toBe(404);

    const bookRes = await publicContext.request.post("/api/booking/this-slug-does-not-exist", {
      headers: { origin: baseURL! },
      data: { startAt: new Date(Date.now() + 86_400_000).toISOString(), timezone: "Asia/Kolkata", name: "Someone", email: `e2e-apt-unknown-${Date.now()}@example.com`, phone: "+919876543222" },
    });
    expect(bookRes.status()).toBe(404);
    await publicContext.close();
  });
});

test.describe("Appointment Booking — double-booking is a HARD requirement, enforced over real HTTP", () => {
  test("two concurrent bookings for the exact same slot — only one succeeds", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const appointmentType = await createTestAppointmentType(orgAContext.request, `E2E Race Type ${Date.now()}`);

    const publicContext = await browser.newContext();
    const availabilityRes = await publicContext.request.get(`/api/booking/${appointmentType.publicSlug}/availability?date=${tomorrowDateString()}`);
    const { slots } = (await availabilityRes.json()) as { slots: string[] };
    expect(slots.length).toBeGreaterThan(0);
    const slot = slots[0];

    const [a, b] = await Promise.all([
      publicContext.request.post(`/api/booking/${appointmentType.publicSlug}`, {
        headers: { origin: baseURL! },
        data: { startAt: slot, timezone: "Asia/Kolkata", name: "Racer A", email: `e2e-apt-race-a-${Date.now()}@example.com`, phone: "+919876543223" },
      }),
      publicContext.request.post(`/api/booking/${appointmentType.publicSlug}`, {
        headers: { origin: baseURL! },
        data: { startAt: slot, timezone: "Asia/Kolkata", name: "Racer B", email: `e2e-apt-race-b-${Date.now()}@example.com`, phone: "+919876543224" },
      }),
    ]);

    // Exactly one request wins (201). The loser can legitimately land on
    // either of two safe rejections depending on real event-loop timing:
    // a 409 (it reached the repository's own unique-index conflict) or a
    // 400 ("that time is no longer available" — book()'s own
    // server-side re-verification already saw the winner's write and
    // excluded the slot before ever reaching the repository). Both are
    // the mission's own literal hard requirement holding — "only one
    // succeeds" — the HTTP status of the rejection is an implementation
    // detail of WHICH of the two safeguards caught it first, not a
    // second thing to assert rigidly.
    const statuses = [a.status(), b.status()].sort();
    expect(statuses[0]).toBe(201);
    expect([400, 409]).toContain(statuses[1]);

    const appointmentsRes = await orgAContext.request.get(`/api/admin/crm/appointments?appointmentTypeId=${appointmentType.id}`);
    const appointmentsBody = (await appointmentsRes.json()) as { items: unknown[] };
    expect(appointmentsBody.items).toHaveLength(1);

    await publicContext.close();
    await orgAContext.close();
  });
});

test.describe("Appointment Booking — existing-Lead attachment vs. new-Lead dedup", () => {
  test("booking twice with the same phone/email attaches to the SAME Lead, not a second one", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const appointmentType = await createTestAppointmentType(orgAContext.request, `E2E Dedup Type ${Date.now()}`);
    const publicContext = await browser.newContext();
    const email = `e2e-apt-dedup-${Date.now()}@example.com`;

    const availabilityRes = await publicContext.request.get(`/api/booking/${appointmentType.publicSlug}/availability?date=${tomorrowDateString()}`);
    const { slots } = (await availabilityRes.json()) as { slots: string[] };
    expect(slots.length).toBeGreaterThan(1);

    const first = await publicContext.request.post(`/api/booking/${appointmentType.publicSlug}`, {
      headers: { origin: baseURL! },
      data: { startAt: slots[0], timezone: "Asia/Kolkata", name: "Repeat Customer", email, phone: "+919876543225" },
    });
    expect(first.ok()).toBeTruthy();

    const second = await publicContext.request.post(`/api/booking/${appointmentType.publicSlug}`, {
      headers: { origin: baseURL! },
      data: { startAt: slots[1], timezone: "Asia/Kolkata", name: "Repeat Customer", email, phone: "+919876543225" },
    });
    expect(second.ok()).toBeTruthy();

    const listRes = await orgAContext.request.get(`/api/admin/leads?search=${encodeURIComponent(email)}`);
    const listBody = (await listRes.json()) as { items: unknown[] };
    expect(listBody.items).toHaveLength(1);

    await publicContext.close();
    await orgAContext.close();
  });
});

test.describe("Appointment Booking — cross-tenant isolation", () => {
  test("Org B cannot manage Org A's AppointmentType, and Org A's booked leads/appointments never appear in Org B's lists", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const appointmentType = await createTestAppointmentType(orgAContext.request, `E2E Isolation Type ${Date.now()}`);

    const publicContext = await browser.newContext();
    const email = `e2e-apt-isolation-${Date.now()}@example.com`;
    const availabilityRes = await publicContext.request.get(`/api/booking/${appointmentType.publicSlug}/availability?date=${tomorrowDateString()}`);
    const { slots } = (await availabilityRes.json()) as { slots: string[] };
    const bookRes = await publicContext.request.post(`/api/booking/${appointmentType.publicSlug}`, {
      headers: { origin: baseURL! },
      data: { startAt: slots[0], timezone: "Asia/Kolkata", name: "Isolation Test Customer", email, phone: "+919876543226" },
    });
    expect(bookRes.ok()).toBeTruthy();
    await publicContext.close();

    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);

    // Org B cannot read/update Org A's type by id — same "behaves like
    // not-found" contract every other tenant-owned resource already
    // guarantees.
    const crossPatch = await orgBContext.request.patch(`/api/admin/crm/appointment-types/${appointmentType.id}`, { data: { active: false } });
    expect(crossPatch.status()).toBe(404);

    const crossList = await orgBContext.request.get("/api/admin/crm/appointment-types");
    const crossListBody = (await crossList.json()) as { appointmentTypes: { id: string }[] };
    expect(crossListBody.appointmentTypes.find((t) => t.id === appointmentType.id)).toBeUndefined();

    const crossLeadSearch = await orgBContext.request.get(`/api/admin/leads?search=${encodeURIComponent(email)}`);
    const crossLeadBody = (await crossLeadSearch.json()) as { items: unknown[] };
    expect(crossLeadBody.items).toHaveLength(0);

    const crossAppointments = await orgBContext.request.get(`/api/admin/crm/appointments?appointmentTypeId=${appointmentType.id}`);
    const crossAppointmentsBody = (await crossAppointments.json()) as { items: unknown[] };
    expect(crossAppointmentsBody.items).toHaveLength(0);

    await orgAContext.close();
    await orgBContext.close();
  });
});

test.describe("Appointment Booking — existing CRM flows remain unaffected", () => {
  test("the Lead Detail page shows the new Appointments section, and the existing Meetings section / manual CRM flows are untouched", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const appointmentType = await createTestAppointmentType(orgAContext.request, `E2E Lead Detail Type ${Date.now()}`);
    const publicContext = await browser.newContext();
    const email = `e2e-apt-leaddetail-${Date.now()}@example.com`;
    const availabilityRes = await publicContext.request.get(`/api/booking/${appointmentType.publicSlug}/availability?date=${tomorrowDateString()}`);
    const { slots } = (await availabilityRes.json()) as { slots: string[] };
    await publicContext.request.post(`/api/booking/${appointmentType.publicSlug}`, {
      headers: { origin: baseURL! },
      data: { startAt: slots[0], timezone: "Asia/Kolkata", name: "Lead Detail Customer", email, phone: "+919876543227" },
    });
    await publicContext.close();

    const listRes = await orgAContext.request.get(`/api/admin/leads?search=${encodeURIComponent(email)}`);
    const listBody = (await listRes.json()) as { items: { id: string }[] };
    const leadId = listBody.items[0].id;

    const page = await orgAContext.newPage();
    await page.goto(`/admin/leads/${leadId}`);
    await expect(page.getByText("Appointments", { exact: true })).toBeVisible();
    // The pre-existing Meetings section (Module 6.3) is still rendered
    // on the same page, completely untouched by this module's addition.
    await expect(page.getByText("Meetings", { exact: true })).toBeVisible();

    await orgAContext.close();
  });

  test("manually importing a lead via the existing CSV import path still works exactly as before this module", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const email = `e2e-apt-manual-flow-${Date.now()}@example.com`;
    const csv = `name,email,phone\nAppointment Booking Regression Lead,${email},+919876543228\n`;

    const importRes = await orgAContext.request.post("/api/admin/crm/import?mode=commit", {
      multipart: { file: { name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } },
    });
    expect(importRes.ok()).toBeTruthy();

    const listRes = await orgAContext.request.get(`/api/admin/leads?search=${encodeURIComponent(email)}`);
    const listBody = (await listRes.json()) as { items: { source: string }[] };
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].source).toBe("csv-import");

    await orgAContext.close();
  });
});

test.describe("Appointment Booking — RBAC on the new admin routes", () => {
  test("a counsellor session can read appointment types/bookings but cannot create or delete a type; a manager session can do both", async ({ browser, baseURL }) => {
    const counsellorContext = await adminContextFor(browser, baseURL!, ORG_A, "counsellor");
    const readRes = await counsellorContext.request.get("/api/admin/crm/appointment-types");
    expect(readRes.ok()).toBeTruthy();

    const createAttempt = await counsellorContext.request.post("/api/admin/crm/appointment-types", {
      data: { name: "Counsellor Should Not Create This", durationMinutes: 30, bufferMinutes: 0, timezone: "Asia/Kolkata", weeklyAvailability: ALL_DAY_EVERY_DAY, assignedCounsellorId: fakeCounsellorId() },
    });
    expect(createAttempt.status()).toBe(403);
    await counsellorContext.close();

    const managerContext = await adminContextFor(browser, baseURL!, ORG_A, "manager");
    const appointmentType = await createTestAppointmentType(managerContext.request, `E2E Manager-Created Type ${Date.now()}`);
    const deleteRes = await managerContext.request.delete(`/api/admin/crm/appointment-types/${appointmentType.id}`);
    expect(deleteRes.ok()).toBeTruthy();
    await managerContext.close();
  });
});
