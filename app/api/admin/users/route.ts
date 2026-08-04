import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { authService } from "@/lib/services/auth";

/**
 * GET /api/admin/users
 *
 * Enterprise CRM (Phase 1) — the staff directory: every active
 * counsellor/manager/admin, for Lead Assignment pickers (manual +
 * round-robin rule builder) and Task assignee selection. Returns
 * PublicUser only (no passwordHash) — same projection every other
 * auth-facing response already uses.
 *
 * ⚠️ requiredRole: "manager" — assignment/reassignment is a Manager
 * capability (RBAC), and both pickers this feeds are manager-only UI. A
 * counsellor never needs the full staff list — they work their own
 * queue, not anyone else's.
 */
async function handleListUsers(): Promise<NextResponse> {
  const users = await authService.listActiveStaff();
  return apiSuccess({ users });
}

export const GET = withApiRoute("admin.users.list", handleListUsers, {
  requiredRole: "manager",
  rateLimit: { limit: 60, windowMs: 60_000 },
});
