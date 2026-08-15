import mongoose from "mongoose";
import { describe, it, expect } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { appointmentTypeService } from "./appointmentTypeService";

function uniqueOrg(label: string): string {
  return `org-atype-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fakeCounsellorId(): string {
  return new mongoose.Types.ObjectId().toHexString();
}

const VALID_WEEKLY_AVAILABILITY = [{ dayOfWeek: 1 as const, startMinute: 540, endMinute: 1020 }];

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Free Counselling Call",
    durationMinutes: 30,
    bufferMinutes: 0,
    timezone: "Asia/Kolkata",
    weeklyAvailability: VALID_WEEKLY_AVAILABILITY,
    assignedCounsellorId: fakeCounsellorId(),
    ...overrides,
  };
}

describe("appointmentTypeService.createAppointmentType", () => {
  it("rejects a missing name", async () => {
    const result = await runWithTenantContext({ organizationId: uniqueOrg("validation-name") }, () =>
      appointmentTypeService.createAppointmentType(validInput({ name: "" })),
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
  });

  it("rejects an invalid timezone", async () => {
    const result = await runWithTenantContext({ organizationId: uniqueOrg("validation-tz") }, () =>
      appointmentTypeService.createAppointmentType(validInput({ timezone: "Not/A/Zone" })),
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.errors.some((e) => e.field === "timezone")).toBe(true);
  });

  it("rejects a missing assignedCounsellorId", async () => {
    const result = await runWithTenantContext({ organizationId: uniqueOrg("validation-counsellor") }, () =>
      appointmentTypeService.createAppointmentType(validInput({ assignedCounsellorId: "" })),
    );
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.errors.some((e) => e.field === "assignedCounsellorId")).toBe(true);
  });

  it("generates a publicSlug derived from the name", async () => {
    const result = await runWithTenantContext({ organizationId: uniqueOrg("slug") }, () =>
      appointmentTypeService.createAppointmentType(validInput({ name: "Free Counselling Call" })),
    );
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.appointmentType.publicSlug).toBe("free-counselling-call");
    expect(result.appointmentType.active).toBe(true);
  });

  it("appends a random suffix on a slug collision rather than failing — publicSlug is global, not per-organization", async () => {
    const orgA = uniqueOrg("collision-a");
    const orgB = uniqueOrg("collision-b");
    const first = await runWithTenantContext({ organizationId: orgA }, () => appointmentTypeService.createAppointmentType(validInput({ name: "Consult" })));
    expect(first.success).toBe(true);

    const second = await runWithTenantContext({ organizationId: orgB }, () => appointmentTypeService.createAppointmentType(validInput({ name: "Consult" })));
    expect(second.success).toBe(true);
    if (!first.success || !second.success) throw new Error("expected both to succeed");
    expect(second.appointmentType.publicSlug).not.toBe(first.appointmentType.publicSlug);
    expect(second.appointmentType.publicSlug.startsWith("consult")).toBe(true);
  });
});

describe("appointmentTypeService — tenant isolation", () => {
  it("listAppointmentTypes only returns the active organization's own types", async () => {
    const orgA = uniqueOrg("list-a");
    const orgB = uniqueOrg("list-b");
    await runWithTenantContext({ organizationId: orgA }, () => appointmentTypeService.createAppointmentType(validInput({ name: "Org A Type" })));
    await runWithTenantContext({ organizationId: orgB }, () => appointmentTypeService.createAppointmentType(validInput({ name: "Org B Type" })));

    const listA = await runWithTenantContext({ organizationId: orgA }, () => appointmentTypeService.listAppointmentTypes());
    expect(listA.map((t) => t.name)).toEqual(["Org A Type"]);

    const listB = await runWithTenantContext({ organizationId: orgB }, () => appointmentTypeService.listAppointmentTypes());
    expect(listB.map((t) => t.name)).toEqual(["Org B Type"]);
  });
});

describe("appointmentTypeService.updateAppointmentType / deleteAppointmentType", () => {
  it("updateAppointmentType can pause a type (active: false)", async () => {
    const org = uniqueOrg("update");
    const created = await runWithTenantContext({ organizationId: org }, () => appointmentTypeService.createAppointmentType(validInput({ name: "Toggle Me" })));
    if (!created.success) throw new Error("seed failed");

    const updated = await runWithTenantContext({ organizationId: org }, () => appointmentTypeService.updateAppointmentType(created.appointmentType.id, { active: false }));
    expect(updated.success).toBe(true);
    if (!updated.success) throw new Error("expected success");
    expect(updated.appointmentType.active).toBe(false);
  });

  it("deleteAppointmentType removes the type from listAppointmentTypes", async () => {
    const org = uniqueOrg("delete");
    const created = await runWithTenantContext({ organizationId: org }, () => appointmentTypeService.createAppointmentType(validInput({ name: "Delete Me" })));
    if (!created.success) throw new Error("seed failed");

    await runWithTenantContext({ organizationId: org }, () => appointmentTypeService.deleteAppointmentType(created.appointmentType.id));
    const list = await runWithTenantContext({ organizationId: org }, () => appointmentTypeService.listAppointmentTypes());
    expect(list.find((t) => t.id === created.appointmentType.id)).toBeUndefined();
  });
});
