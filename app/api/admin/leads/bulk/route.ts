import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, ForbiddenApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { leadService } from "@/lib/services/leads";
import type { LeadListFilters } from "@/lib/services/leads";

type BulkAction = "update" | "delete" | "restore" | "archive" | "unarchive" | "assign" | "tag";

interface BulkRequestBody {
  action?: BulkAction;
  /** Explicit id set — "select these rows." */
  ids?: string[];
  /** "Select all matching this filter" — mutually exclusive with `ids`
   *  in practice, but the service accepts either (ids wins if both are
   *  present, see leadService._resolveBulkTargets). */
  filters?: LeadListFilters;
  update?: Record<string, unknown>;
  counsellorId?: string;
  tagId?: string;
}

/**
 * POST /api/admin/leads/bulk
 *
 * Enterprise CRM (Phase 1) — Bulk Operations: assign, delete, archive,
 * update, tag (export is a plain GET .../leads?format=csv with the same
 * filters, already existing — no bulk-specific export endpoint needed).
 * One route, an `action` discriminator, rather than five near-identical
 * routes — every action already funnels through leadService's own
 * per-action method, each independently audit-logged with the resolved
 * id list (see leadService.ts's own comment on why).
 *
 * ⚠️ RBAC: "manager" tier for update/archive/unarchive/restore/assign/tag
 * — bulk CRM management is a Manager capability. `action: "delete"` is
 * "admin"-only, checked inside the handler (a per-action distinction the
 * route-level `requiredRole` option can't express) — bulk-affecting many
 * records at once is the one bulk action this module reserves for the
 * top tier, even though it's a soft-delete (RC-5 — see
 * leadService.bulkDelete's own doc comment; `action: "restore"` is the
 * undo path, gated at the base "manager" tier like the rest). Bulk
 * actions are the highest blast-radius write surface in this module;
 * role-gating here is not optional.
 */
async function handleBulkAction(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = (await parseJsonBody(request)) as BulkRequestBody;
  const context = { actorId: ctx.authContext.userId, requestId: ctx.requestId };

  if (!body.ids?.length && !body.filters) {
    throw new ValidationApiError([{ field: "root", message: "Either ids or filters is required to select target leads." }]);
  }
  if (body.action === "delete" && ctx.authContext.role !== "admin") {
    throw new ForbiddenApiError("Only an admin can bulk-delete leads.");
  }

  switch (body.action) {
    case "update": {
      if (!body.update) throw new ValidationApiError([{ field: "update", message: "update is required." }]);
      const result = await leadService.bulkUpdate(body.ids, body.filters, body.update, context);
      return apiSuccess({ result });
    }
    case "delete": {
      // RC-5 — this is a soft-delete (leadService.bulkDelete sets
      // Lead.deletedAt, never a real deleteMany) — see "restore" below
      // for the undo path.
      const result = await leadService.bulkDelete(body.ids, body.filters, context);
      return apiSuccess({ result });
    }
    case "restore": {
      const result = await leadService.bulkRestore(body.ids, body.filters, context);
      return apiSuccess({ result });
    }
    case "archive": {
      const result = await leadService.bulkArchive(body.ids, body.filters, true, context);
      return apiSuccess({ result });
    }
    case "unarchive": {
      const result = await leadService.bulkArchive(body.ids, body.filters, false, context);
      return apiSuccess({ result });
    }
    case "assign": {
      if (!body.counsellorId) throw new ValidationApiError([{ field: "counsellorId", message: "counsellorId is required." }]);
      const result = await leadService.bulkAssign(body.ids, body.filters, body.counsellorId, context);
      return apiSuccess({ result });
    }
    case "tag": {
      if (!body.tagId) throw new ValidationApiError([{ field: "tagId", message: "tagId is required." }]);
      const result = await leadService.bulkTag(body.ids, body.filters, body.tagId, context);
      return apiSuccess({ result });
    }
    default:
      throw new ValidationApiError([
        { field: "action", message: "action must be one of: update, delete, restore, archive, unarchive, assign, tag." },
      ]);
  }
}

export const POST = withApiRoute("admin.leads.bulk", handleBulkAction, {
  requiredRole: "manager",
  rateLimit: { limit: 10, windowMs: 60_000 },
});
