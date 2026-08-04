import { timingSafeEqual } from "crypto";
import { CRON_SECRET, IS_CRON_CONFIGURED } from "@/config/cron";

/**
 * Authenticates a scheduled-job trigger (Vercel Cron, or any external
 * scheduler hitting app/api/cron/*) via a bearer secret instead of the
 * admin JWT cookie every other protected route relies on — a cron
 * invocation has no browser session. Vercel automatically attaches
 * `Authorization: Bearer $CRON_SECRET` to requests it triggers from a
 * `vercel.json` cron entry once CRON_SECRET is set as a project env var;
 * an external scheduler must be configured to send the same header.
 *
 * Constant-time comparison — same reasoning as the WhatsApp webhook's
 * HMAC check (lib/services/whatsapp/providers/metaCloudApi.provider.ts):
 * a naive `===` would leak timing information an attacker could use to
 * guess the correct secret byte-by-byte. Fails closed if CRON_SECRET
 * isn't configured — every app/api/cron/* route stays fully inert until
 * a real secret is set, rather than falling back to an insecure default.
 */
export function isValidCronRequest(request: Request): boolean {
  if (!IS_CRON_CONFIGURED) return false;

  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return false;

  const provided = header.slice("Bearer ".length);
  const expected = CRON_SECRET;

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
