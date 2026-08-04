import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";
import { encryptSecret, isNotificationProviderId } from "@/lib/services/webhooks";
import { throwForIntegrationError } from "../../_lib/errorMapping";

/**
 * POST /api/admin/integrations/[providerId]/webhook-url
 *
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
 * real "Connect" mechanism for Slack/Microsoft Teams/Discord: these
 * providers need one opaque Incoming Webhook URL as their whole
 * credential (see IntegrationCredentialRef's own "webhook_url" doc
 * comment), so — unlike the generic `/connect` route (Module 6.1,
 * which accepts whatever credentialRef shape a client sends) — this
 * route accepts the PLAINTEXT url and encrypts it server-side before
 * ever constructing a credentialRef, the same "never trust a client to
 * hand you an already-encrypted-looking value" posture the 6.3 OAuth
 * callback route already established for a different credential shape.
 *
 * ⚠️ requiredRole: "admin" — same tier as every other connect path.
 */
async function handleConnectWebhookUrl(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  if (!isNotificationProviderId(providerId)) throw new NotFoundApiError("Integration", providerId);

  const body = await request.json().catch(() => null);
  const webhookUrl = typeof (body as Record<string, unknown> | null)?.webhookUrl === "string" ? ((body as Record<string, unknown>).webhookUrl as string).trim() : "";
  if (!webhookUrl) throw new ValidationApiError([{ field: "webhookUrl", message: "webhookUrl is required." }]);

  try {
    new URL(webhookUrl);
  } catch {
    throw new ValidationApiError([{ field: "webhookUrl", message: "webhookUrl must be a valid URL." }]);
  }

  const result = await integrationService.connect(
    providerId,
    { credentialRef: { type: "webhook_url", encryptedUrl: encryptSecret(webhookUrl) } },
    { actorId: ctx.authContext.userId, requestId: ctx.requestId },
  );
  if (!result.success) throwForIntegrationError(result.error, providerId);
  return apiSuccess({ integration: result.data }, 201);
}

export const POST = withApiRoute("admin.integrations.notifications.connectWebhookUrl", handleConnectWebhookUrl, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});
