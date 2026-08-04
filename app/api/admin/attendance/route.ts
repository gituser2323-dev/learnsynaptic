import { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, parsePaginationParams, toCsv, ValidationApiError } from "@/lib/api";
import { attendanceService } from "@/lib/services/attendance";
import type { AttendanceListFilters } from "@/lib/services/attendance";

/**
 * GET /api/admin/attendance, POST /api/admin/attendance
 *
 * Admin Dashboard Backend — Attendance. POST records a session's
 * present/absent for a Registration (after confirming that
 * registrationId is real — see attendanceService.markAttendance()); GET
 * lists, filterable by registrationId/sessionLabel, with CSV export.
 *
 * ⚠️ requiredRole: "admin" for both — fails closed until real auth
 * exists, same as every route in this module.
 */
async function handleMarkAttendance(request: Request): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  const result = await attendanceService.markAttendance(body);

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ attendance: result.attendance }, 201);
}

async function handleListAttendance(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const filters: AttendanceListFilters = {
    registrationId: searchParams.get("registrationId") || undefined,
    sessionLabel: searchParams.get("sessionLabel") || undefined,
  };

  const format = searchParams.get("format");
  if (format === "csv") {
    const { items } = await attendanceService.listAttendance(filters, 1, 5000);
    const csv = toCsv(items, [
      { header: "id", value: (a) => a.id },
      { header: "registrationId", value: (a) => a.registrationId },
      { header: "sessionLabel", value: (a) => a.sessionLabel },
      { header: "sessionDate", value: (a) => a.sessionDate },
      { header: "present", value: (a) => a.present },
      { header: "markedAt", value: (a) => a.markedAt },
    ]);
    return new NextResponse(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=attendance.csv" },
    });
  }

  const { page, limit } = parsePaginationParams(searchParams);
  const result = await attendanceService.listAttendance(filters, page, limit);
  return apiSuccess({ ...result });
}

export const POST = withApiRoute("admin.attendance.mark", handleMarkAttendance, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const GET = withApiRoute("admin.attendance.list", handleListAttendance, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
