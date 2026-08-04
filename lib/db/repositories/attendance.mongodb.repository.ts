import { getConnection } from "@/lib/db/connection";
import { AttendanceModel, toAttendance } from "@/lib/db/models/attendance.model";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import type {
  Attendance,
  AttendanceListFilters,
  AttendanceRepository,
  CreateAttendanceInput,
} from "@/lib/services/attendance/types";

export const mongodbAttendanceRepository: AttendanceRepository = {
  async create(input: CreateAttendanceInput): Promise<Attendance> {
    await getConnection();
    const doc = await AttendanceModel.create(input);
    return toAttendance(doc);
  },

  async list(filters: AttendanceListFilters, page: number, limit: number): Promise<PaginatedResult<Attendance>> {
    await getConnection();
    const query: Record<string, unknown> = {};
    if (filters.registrationId) query.registrationId = filters.registrationId;
    if (filters.sessionLabel) query.sessionLabel = filters.sessionLabel;

    const [docs, total] = await Promise.all([
      AttendanceModel.find(query)
        .sort({ sessionDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      AttendanceModel.countDocuments(query).exec(),
    ]);

    return buildPaginatedResult(docs.map(toAttendance), total, { page, limit });
  },

  async overallAttendanceRate(): Promise<number | null> {
    await getConnection();
    const total = await AttendanceModel.countDocuments({}).exec();
    if (total === 0) return null;
    const present = await AttendanceModel.countDocuments({ present: true }).exec();
    return present / total;
  },
};
