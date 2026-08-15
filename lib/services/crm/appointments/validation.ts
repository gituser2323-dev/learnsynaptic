import mongoose from "mongoose";
import type { CreateAppointmentTypeInput, UpdateAppointmentTypeInput, WeeklyAvailabilitySlot } from "./types";

export interface AppointmentTypeValidationError {
  field: string;
  message: string;
}

export type CreateValidationResult =
  | { valid: true; data: CreateAppointmentTypeInput }
  | { valid: false; errors: AppointmentTypeValidationError[] };

export type UpdateValidationResult =
  | { valid: true; data: UpdateAppointmentTypeInput }
  | { valid: false; errors: AppointmentTypeValidationError[] };

// A conservative, real IANA timezone check (not exhaustive — Intl itself
// is the source of truth) — the exact same check
// lib/services/calendar/validation.ts's own isValidTimezone already
// uses, reused by inline copy rather than a cross-module import (this
// module doesn't otherwise depend on lib/services/calendar).
function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function parseWeeklyAvailability(raw: unknown, errors: AppointmentTypeValidationError[]): WeeklyAvailabilitySlot[] {
  if (!Array.isArray(raw)) {
    errors.push({ field: "weeklyAvailability", message: "weeklyAvailability must be an array." });
    return [];
  }
  const slots: WeeklyAvailabilitySlot[] = [];
  raw.forEach((entry, index) => {
    const record = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const dayOfWeek = typeof record.dayOfWeek === "number" ? record.dayOfWeek : -1;
    const startMinute = typeof record.startMinute === "number" ? record.startMinute : -1;
    const endMinute = typeof record.endMinute === "number" ? record.endMinute : -1;
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      errors.push({ field: `weeklyAvailability[${index}].dayOfWeek`, message: "dayOfWeek must be 0-6." });
      return;
    }
    if (startMinute < 0 || startMinute > 1440 || endMinute < 0 || endMinute > 1440) {
      errors.push({ field: `weeklyAvailability[${index}]`, message: "startMinute/endMinute must be between 0 and 1440." });
      return;
    }
    if (endMinute <= startMinute) {
      errors.push({ field: `weeklyAvailability[${index}]`, message: "endMinute must be after startMinute." });
      return;
    }
    slots.push({ dayOfWeek: dayOfWeek as WeeklyAvailabilitySlot["dayOfWeek"], startMinute, endMinute });
  });
  return slots;
}

export function validateCreateAppointmentTypeInput(input: unknown): CreateValidationResult {
  const errors: AppointmentTypeValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.push({ field: "name", message: "Name is required." });
  else if (name.length > 100) errors.push({ field: "name", message: "Name must be 100 characters or fewer." });

  const description = typeof body.description === "string" ? body.description.trim() : undefined;
  if (description && description.length > 500) errors.push({ field: "description", message: "Description must be 500 characters or fewer." });

  const durationMinutes = typeof body.durationMinutes === "number" ? body.durationMinutes : NaN;
  if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    errors.push({ field: "durationMinutes", message: "Duration must be between 5 and 480 minutes." });
  }

  const bufferMinutesRaw = body.bufferMinutes;
  const bufferMinutes = typeof bufferMinutesRaw === "number" ? bufferMinutesRaw : 0;
  if (bufferMinutes < 0 || bufferMinutes > 240) errors.push({ field: "bufferMinutes", message: "Buffer must be between 0 and 240 minutes." });

  const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "";
  if (!timezone || !isValidTimezone(timezone)) errors.push({ field: "timezone", message: "timezone must be a valid IANA timezone, e.g. \"Asia/Kolkata\"." });

  const weeklyAvailability = parseWeeklyAvailability(body.weeklyAvailability, errors);
  if (weeklyAvailability.length === 0 && errors.every((e) => e.field !== "weeklyAvailability")) {
    errors.push({ field: "weeklyAvailability", message: "At least one available day/time range is required." });
  }

  const assignedCounsellorId = typeof body.assignedCounsellorId === "string" ? body.assignedCounsellorId.trim() : "";
  if (!assignedCounsellorId || !mongoose.isValidObjectId(assignedCounsellorId)) {
    errors.push({ field: "assignedCounsellorId", message: "A valid assigned counsellor is required." });
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      name,
      description,
      durationMinutes,
      bufferMinutes,
      timezone,
      weeklyAvailability,
      assignedCounsellorId,
    },
  };
}

export function validateUpdateAppointmentTypeInput(input: unknown): UpdateValidationResult {
  const errors: AppointmentTypeValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const data: UpdateAppointmentTypeInput = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) errors.push({ field: "name", message: "Name is required." });
    else if (name.length > 100) errors.push({ field: "name", message: "Name must be 100 characters or fewer." });
    else data.name = name;
  }

  if (body.description !== undefined) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > 500) errors.push({ field: "description", message: "Description must be 500 characters or fewer." });
    else data.description = description;
  }

  if (body.durationMinutes !== undefined) {
    const durationMinutes = typeof body.durationMinutes === "number" ? body.durationMinutes : NaN;
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      errors.push({ field: "durationMinutes", message: "Duration must be between 5 and 480 minutes." });
    } else data.durationMinutes = durationMinutes;
  }

  if (body.bufferMinutes !== undefined) {
    const bufferMinutes = typeof body.bufferMinutes === "number" ? body.bufferMinutes : NaN;
    if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 240) {
      errors.push({ field: "bufferMinutes", message: "Buffer must be between 0 and 240 minutes." });
    } else data.bufferMinutes = bufferMinutes;
  }

  if (body.timezone !== undefined) {
    const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "";
    if (!timezone || !isValidTimezone(timezone)) errors.push({ field: "timezone", message: "timezone must be a valid IANA timezone, e.g. \"Asia/Kolkata\"." });
    else data.timezone = timezone;
  }

  if (body.weeklyAvailability !== undefined) {
    const weeklyAvailability = parseWeeklyAvailability(body.weeklyAvailability, errors);
    data.weeklyAvailability = weeklyAvailability;
  }

  if (body.assignedCounsellorId !== undefined) {
    const assignedCounsellorId = typeof body.assignedCounsellorId === "string" ? body.assignedCounsellorId.trim() : "";
    if (!assignedCounsellorId || !mongoose.isValidObjectId(assignedCounsellorId)) {
      errors.push({ field: "assignedCounsellorId", message: "A valid assigned counsellor is required." });
    } else data.assignedCounsellorId = assignedCounsellorId;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") errors.push({ field: "active", message: "active must be true or false." });
    else data.active = body.active;
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data };
}
