import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { listWorkflowCatalog, createWorkflowDefinition } from "@/lib/services/automation";

/**
 * GET /api/admin/automation/definitions, POST /api/admin/automation/definitions
 *
 * Automation Platform (Phase 3), Module 3.1 — persisted, admin-editable
 * workflow definitions. GET is the Automation page's catalog view
 * (now database-backed, no longer a static code list — reflects an
 * admin's edits immediately, no redeploy). POST creates a new
 * definition; steps are authored as JSON against the
 * action/condition registries (lib/services/automation/{actions,conditions})
 * — a drag-and-drop builder is Module 3.2's job, not this one's.
 *
 * ⚠️ requiredRole: "admin" for both — a persisted definition can send
 * real WhatsApp messages, assign leads, or create tasks automatically,
 * the same blast radius as the WhatsApp Campaign Manager, not CRM
 * configuration a manager should be able to touch alone.
 */
async function handleListDefinitions(): Promise<NextResponse> {
  const items = await listWorkflowCatalog();
  return apiSuccess({ items });
}

async function handleCreateDefinition(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const body = await parseJsonBody(request);
  const result = await createWorkflowDefinition(body, { requestId: ctx.requestId, actorId: ctx.authContext.userId });

  if (!result.success) {
    throw new ValidationApiError(result.errors);
  }

  return apiSuccess({ definition: result.definition }, 201);
}

export const GET = withApiRoute("admin.automation.definitions.list", handleListDefinitions, {
  requiredRole: "admin",
  rateLimit: { limit: 60, windowMs: 60_000 },
});

export const POST = withApiRoute("admin.automation.definitions.create", handleCreateDefinition, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});
