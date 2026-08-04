import { WHATSAPP_ACTIVE_PROVIDER } from "@/config/whatsapp";
import { getTenantContext } from "@/lib/tenancy/context";
import { resolveTenantCredentials } from "@/lib/services/integrations/credentialResolver";
import { consoleProvider } from "./providers/console.provider";
import { metaCloudApiProvider } from "./providers/metaCloudApi.provider";
import { aisensyProvider } from "./providers/aisensy.provider";
import { interaktProvider } from "./providers/interakt.provider";
import { watiProvider } from "./providers/wati.provider";
import { gallaboxProvider } from "./providers/gallabox.provider";
import type { WhatsAppProvider, WhatsAppProviderId } from "./types";

/**
 * The single seam where a provider id (config, driven by WHATSAPP_PROVIDER)
 * becomes a concrete WhatsAppProvider instance. This file is the ONLY
 * place in the app allowed to import a concrete provider adapter —
 * whatsappService.ts and everything that calls it depend solely on the
 * WhatsAppProvider interface (types.ts), never on a specific vendor.
 *
 * Swapping vendors, or adding a 6th, only ever touches this file plus one
 * new adapter file — no caller anywhere else changes.
 */
const registry: Record<WhatsAppProviderId, WhatsAppProvider> = {
  console: consoleProvider,
  "meta-cloud-api": metaCloudApiProvider,
  aisensy: aisensyProvider,
  interakt: interaktProvider,
  wati: watiProvider,
  gallabox: gallaboxProvider,
};

export function getWhatsAppProvider(): WhatsAppProvider {
  return registry[WHATSAPP_ACTIVE_PROVIDER];
}

/**
 * Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup. The one
 * real architectural fix this module needs to make tenant self-service
 * actually work end to end: without this, an organization that
 * completes Embedded Signup and gets its own real Meta credentials
 * stored (Module 8.2's `tenant_secret` mechanism) would still have every
 * send routed through whichever ONE provider class this deployment's
 * own `WHATSAPP_PROVIDER` env var picks — if that's still "console"
 * (this app's own zero-config default), a fully-connected tenant's
 * messages would silently never reach Meta at all. Never a per-tenant
 * env edit, never a database record LearnSynaptic staff hand-edit: the
 * organization's own presence of a real, resolvable `accessToken` +
 * `phoneNumberId` tenant credential IS the signal that its sends should
 * go through Meta Cloud API specifically, regardless of the
 * deployment-wide default. This mirrors, one layer up, the exact
 * "tenant credential first, env config always the fallback" precedent
 * `metaCloudApi.provider.ts`'s own `resolveEffectiveConfig()` already
 * established for credential VALUES — this is the same idea applied to
 * provider CLASS selection.
 *
 * Deliberately only ever resolves to `metaCloudApiProvider` (never
 * aisensy/interakt/wati/gallabox) — Embedded Signup is a Meta-specific
 * onboarding flow; an organization using this path is, by construction,
 * a Meta Cloud API tenant. The alternate BSPs remain exactly what they
 * already were: this deployment's own operator-configured choice, never
 * something a tenant self-connects to.
 *
 * Reads the ambient ORGANIZATION ID explicitly passed in (never implicit
 * `getTenantContext()` alone reached through some other path) so this
 * stays safe to call from a background job that has resolved its own
 * org as a plain value, the same calling convention every other
 * Module 8.x tenant-aware function already established.
 */
export async function resolveWhatsAppProviderForSend(organizationId?: string): Promise<WhatsAppProvider> {
  const orgId = organizationId ?? getTenantContext()?.organizationId;
  if (orgId) {
    const creds = await resolveTenantCredentials(orgId, "whatsapp", ["accessToken", "phoneNumberId"]);
    if (creds.accessToken && creds.phoneNumberId) return metaCloudApiProvider;
  }
  return getWhatsAppProvider();
}
