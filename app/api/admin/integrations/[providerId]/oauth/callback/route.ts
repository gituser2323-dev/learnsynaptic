import { NextResponse } from "next/server";
import { withApiRoute } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { calendarService } from "@/lib/services/calendar";

/**
 * GET /api/admin/integrations/[providerId]/oauth/callback
 *
 * Calendar & Meeting Connectors (Phase 6), Module 6.3 — where
 * Google/Microsoft/Zoom redirect the browser back to after the admin
 * grants (or denies) consent. Still the same authenticated browser
 * session throughout (the admin never left their own logged-in tab —
 * the vendor's consent screen was a redirect, not a new session), so
 * this stays behind the normal `requiredRole: "admin"` gate rather
 * than needing 6.2's local-signed-URL route's unauthenticated
 * exception (that one existed for a fundamentally different reason —
 * access without ANY session at all).
 *
 * Redirects back to Settings either way — a JSON error response would
 * show raw JSON to a human mid-browser-flow, the wrong UX for a
 * full-page navigation endpoint. The `providerId` param IS trusted
 * from the URL path here (unlike a client-supplied body): `state`'s
 * own signature is the real integrity check (see oauthState.ts), and
 * a mismatched providerId-vs-state simply fails that check.
 */
async function handleCallback(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const vendorError = searchParams.get("error");

  const settingsUrl = new URL("/admin/settings", request.url);

  if (vendorError || !code || !state) {
    settingsUrl.searchParams.set("calendarError", vendorError ? "denied" : "invalid_request");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const providerId = await calendarService.completeOAuthConnection(state, code, {
      actorId: ctx.authContext.userId,
      requestId: ctx.requestId,
    });
    settingsUrl.searchParams.set("calendarConnected", providerId);
  } catch {
    // Never leak the underlying vendor error text into a URL a browser
    // history/referrer could retain — a short, safe, generic code only.
    // The real error is already logged server-side by handleApiError's
    // own would-be path; this route deliberately never lets that error
    // propagate as a raw JSON 500 mid-redirect-flow.
    settingsUrl.searchParams.set("calendarError", "connection_failed");
  }

  return NextResponse.redirect(settingsUrl);
}

export const GET = withApiRoute("admin.integrations.calendar.oauthCallback", handleCallback, {
  requiredRole: "admin",
  rateLimit: { limit: 20, windowMs: 60_000 },
});
