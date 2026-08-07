import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, NotFoundApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { integrationService } from "@/lib/services/integrations";
import { hasConnectionTest, runConnectionTest } from "@/lib/services/integrations/connectionTest";

/**
 * POST /api/admin/integrations/[providerId]/test-connection
 *
 * Configuration & Integration Verification — the generic "Test
 * Connection" action for every provider category that didn't already
 * have a real one: AI (openai/anthropic/gemini), Storage (aws_s3/
 * cloudinary), Payments (razorpay/stripe/cashfree/phonepe/paypal),
 * Email (postmark), WhatsApp (meta-cloud-api). Calendar providers keep
 * using their own existing calendar-sync route (calendarService.
 * syncNow()) and notification-webhook providers keep using their own
 * notification-test route — both already make a real vendor call and
 * this route doesn't duplicate either.
 *
 * Mirrors notification-test/route.ts's own conventions exactly: never
 * assumes success, records the real outcome via
 * integrationService.recordSync() (so it shows up in the provider's
 * own Logs panel same as every other sync/test event), and always
 * responds 200 with `{result: {success, message}}` — a failed vendor
 * check is an expected, well-formed answer, not a 4xx/5xx.
 */
async function handleTestConnection(_request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { providerId } = ctx.params;
  if (!hasConnectionTest(providerId)) throw new NotFoundApiError("Integration", providerId);

  const result = await runConnectionTest(providerId);
  await integrationService.recordSync(providerId, result.success ? "success" : "failure", result.message);
  return apiSuccess({ result });
}

export const POST = withApiRoute("admin.integrations.testConnection", handleTestConnection, {
  requiredRole: "admin",
  rateLimit: { limit: 10, windowMs: 60_000 },
});
