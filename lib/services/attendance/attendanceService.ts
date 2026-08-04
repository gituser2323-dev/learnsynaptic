import { getRegistrationRepository, getAttendanceRepository } from "@/lib/db";
import { validateCreateAttendanceInput } from "./validation";
import type { PaginatedResult } from "@/lib/pagination";
import type { Attendance, AttendanceListFilters, CreateAttendanceResult } from "./types";

/**
 * Application layer for attendance — mirrors registrationService's
 * pattern of verifying a referenced entity exists before writing against
 * it (here: registrationId must resolve to a real Registration).
 */
export const attendanceService = {
  async markAttendance(input: unknown): Promise<CreateAttendanceResult> {
    const validation = validateCreateAttendanceInput(input);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const registrationRepository = await getRegistrationRepository();
    const registration = await registrationRepository.findById(validation.data.registrationId);
    if (!registration) {
      return {
        success: false,
        errors: [{ field: "registrationId", message: "No registration found with this id." }],
      };
    }

    const attendanceRepository = await getAttendanceRepository();
    const attendance = await attendanceRepository.create(validation.data);
    return { success: true, attendance };
  },

  async listAttendance(
    filters: AttendanceListFilters,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Attendance>> {
    const repository = await getAttendanceRepository();
    return repository.list(filters, page, limit);
  },

  /** Admin Dashboard Backend — Student Status: overall attendance rate
   *  across every recorded session. */
  async getOverallAttendanceRate(): Promise<number | null> {
    const repository = await getAttendanceRepository();
    return repository.overallAttendanceRate();
  },
};
