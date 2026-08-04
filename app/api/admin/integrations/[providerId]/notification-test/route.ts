import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError, ValidationApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";
import { decryptSecret, isNotificationProviderId, getNotificationProvider, NotificationProviderError } from "@/lib/services/webhooks";

/**
 * POST /api/admin/integrations/[providerId]/notification-test
 *
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
 * "Test Notification": a real, immediate send through the connected
 * provider's own real API, the same "prove it actually works, not
 * just that it's configured" posture webhook-endpoints' own Test
 * Endpoint already established.
 */
async function handleTestNotification(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  if (!isNotificationProviderId(providerId)) throw new NotFoundApiError("Integration", providerId);

  const integration = await integrationService.getIntegration(providerId);
  if (!integration || integration.status !== "connected" || integration.credentialRef.type !== "webhook_url") {
    throw new ValidationApiError([{ field: "providerId", message: `${providerId} is not connected.` }]);
  }

  const webhookUrl = decryptSecret(integration.credentialRef.encryptedUrl);
  const provider = getNotificationProvider(providerId);

  try {
    await provider.send(webhookUrl, {
      title: "Test Notification",
      body: "This is a test notification from LearnSynaptic — if you can see this, the connection is working.",
      severity: "info",
    });
    await integrationService.recordSync(providerId, "success", "Test notification delivered.");
    return apiSuccess({ result: { success: true } });
  } catch (error) {
    const message = error instanceof NotificationProviderError ? error.message : "Test notification failed.";
    await integrationService.recordSync(providerId, "failure", message);
    return apiSuccess({ result: { success: false, error: message } });
  }
}

export const POST = withApiRoute("admin.integrations.notifications.test", handleTestNotification, {
  requiredRole: "admin",
  rateLimit: { limit: 10, windowMs: 60_000 },
});
