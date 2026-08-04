import { registrationService } from "@/lib/services/registrations";
import { attendanceService } from "@/lib/services/attendance";
import type { RegistrationStatus } from "@/lib/services/registrations";

/**
 * Admin Dashboard Backend — Student Status. The one piece of analytics
 * that genuinely spans two entities (Registration + Attendance), so it
 * doesn't belong to either service individually. Deliberately a single
 * small file, not a whole new module structure — everything else this
 * module needed (UTM Analytics, Registration Analytics) is a single
 * entity's own concern and lives on that entity's service instead
 * (leadService.getUtmAnalytics(), registrationService.getAnalytics()).
 */
export interface StudentStatusSummary {
  byRegistrationStatus: Record<RegistrationStatus, number>;
  totalRegistrations: number;
  /** null when no attendance has been recorded yet — distinct from 0%. */
  overallAttendanceRate: number | null;
}

export async function getStudentStatusSummary(): Promise<StudentStatusSummary> {
  const [registrationAnalytics, overallAttendanceRate] = await Promise.all([
    registrationService.getAnalytics(),
    attendanceService.getOverallAttendanceRate(),
  ]);

  return {
    byRegistrationStatus: registrationAnalytics.byStatus,
    totalRegistrations: registrationAnalytics.totalRegistrations,
    overallAttendanceRate,
  };
}
