import { getPhoneNumberRepository, getIntegrationConnectionRepository } from "@/lib/db";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { entitlementService, EntitlementError } from "@/lib/services/billing";
import { integrationService } from "@/lib/services/integrations/integrationService";
import { resolveTenantCredentials } from "@/lib/services/integrations/credentialResolver";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { createLogger } from "@/lib/logger";
import { isEmbeddedSignupConfigured } from "@/config/whatsapp";
import { exchangeCodeForToken, listWabaPhoneNumbers, subscribeAppToWaba, unsubscribeAppFromWaba } from "./metaGraphClient";
import { whatsappService } from "../whatsappService";
import { phoneNumberService } from "../phoneNumbers";
import { EmbeddedSignupError } from "./types";
import type { EmbeddedSignupClientResult, WhatsAppConnectionSummary, WhatsAppConnectionState } from "./types";

const logger = createLogger({ service: "whatsapp", module: "embeddedSignup" });

const WHATSAPP_PROVIDER_ID = "whatsapp";

/**
 * Business OS Phase 8, Module 8.5 — the tenant-facing orchestration
 * this whole module exists to build: Meta Embedded Signup's client-side
 * popup result -> a server-side, tenant-isolated, idempotent connection.
 * Deliberately reuses every real mechanism prior Business OS modules
 * already built rather than inventing a parallel one:
 *  - Module 8.3's `entitlementService` gates the whole flow (never a
 *    hardcoded plan-name check).
 *  - Module 8.2's `integrationService.setTenantCredentials()` is the
 *    ONE credential write path — this module never touches encryption,
 *    the IntegrationConnection model, or credential masking directly.
 *  - Module 2.3's `phoneNumberService` is the ONE phone-health/
 *    routing table — extended (Module 8.5), not duplicated.
 *  - Module 8.1's `runWithTenantContext` is how every write below gets
 *    correctly organization-scoped, the same convention every other
 *    Phase 8 module already established.
 */
export const embeddedSignupService = {
  /**
   * The one write path for completing an Embedded Signup popup.
   * `organizationId` MUST come from the caller's own trusted server-side
   * tenant context (the API route resolves it from the authenticated
   * session, never from the request body) — never accepted as a
   * client-supplied field on `input`, the mission's own explicit
   * "never trust organizationId supplied arbitrarily by the browser"
   * requirement.
   *
   * Idempotent: calling this again for the same organization with the
   * same phoneNumberId updates the existing connection in place (a new
   * access token, a refreshed health snapshot) rather than creating a
   * duplicate IntegrationConnection or PhoneNumberRecord row — both
   * underlying writes (`setTenantCredentials`, `phoneNumberService
   * .upsertHealth`) are themselves upserts keyed on a stable id
   * (providerId+organizationId; phoneNumberId globally), so a retried
   * or duplicated completion request converges to the same end state,
   * never accumulating extra rows.
   */
  async connect(organizationId: string, input: EmbeddedSignupClientResult, context: AuditContext = {}): Promise<WhatsAppConnectionSummary> {
    if (!isEmbeddedSignupConfigured()) {
      throw new EmbeddedSignupError("not_configured", "WhatsApp Embedded Signup is not configured on this deployment yet. Contact your platform administrator.");
    }
    if (!input.code || typeof input.code !== "string") {
      throw new EmbeddedSignupError("invalid_request", "Missing authorization code from the WhatsApp signup popup.");
    }

    return runWithTenantContext({ organizationId }, async () => {
      // Server-enforced, never a UI-only gate — an organization whose
      // plan lacks self-service WhatsApp connection is rejected here
      // regardless of what the client attempted to show.
      try {
        await entitlementService.assertCapability(organizationId, "whatsapp_embedded_signup");
      } catch (error) {
        if (error instanceof EntitlementError) {
          throw new EmbeddedSignupError("not_entitled", error.message);
        }
        throw error;
      }

      await auditLogService.record({
        action: AUDIT_ACTIONS.WHATSAPP_SIGNUP_INITIATED,
        entityType: "Integration",
        entityId: WHATSAPP_PROVIDER_ID,
        actorId: context.actorId,
        requestId: context.requestId,
        metadata: { organizationId },
      });

      let accessToken: string;
      try {
        accessToken = await exchangeCodeForToken(input.code);
      } catch (error) {
        await this.recordFailure(organizationId, context, error);
        throw error;
      }

      // The client-reported wabaId is the starting point, but never
      // trusted alone — every candidate phone number is re-derived from
      // Meta itself using the JUST-EXCHANGED token, which only has
      // access to businesses/assets this specific authorization
      // actually granted. A caller that tampers with wabaId/phoneNumberId
      // client-side can, at worst, point at a WABA THEIR OWN token
      // legitimately has access to — never another business's.
      if (!input.wabaId) {
        await this.recordFailure(organizationId, context, new EmbeddedSignupError("discovery_failed", "No WhatsApp Business Account was selected during signup."));
        throw new EmbeddedSignupError("discovery_failed", "No WhatsApp Business Account was selected during signup.");
      }

      let phoneNumbers;
      try {
        phoneNumbers = await listWabaPhoneNumbers(input.wabaId, accessToken);
      } catch (error) {
        await this.recordFailure(organizationId, context, error);
        throw error;
      }

      if (phoneNumbers.length === 0) {
        const error = new EmbeddedSignupError("phone_not_found", "No phone number is available on this WhatsApp Business Account yet — add one in Meta Business Manager and try again.");
        await this.recordFailure(organizationId, context, error);
        throw error;
      }

      const selected = input.phoneNumberId ? phoneNumbers.find((p) => p.phoneNumberId === input.phoneNumberId) : phoneNumbers[0];
      if (!selected) {
        const error = new EmbeddedSignupError("waba_mismatch", "The selected phone number does not belong to the authorized WhatsApp Business Account.");
        await this.recordFailure(organizationId, context, error);
        throw error;
      }

      // Real cross-tenant conflict guard: this exact phone number is
      // already routed to a DIFFERENT organization — reject rather than
      // silently reassigning it (which would let one org hijack
      // another's inbound conversation history). In practice a real
      // Meta phone number belongs to exactly one business, so this only
      // ever fires for a genuine misconfiguration or a stale test
      // fixture, never ordinary use.
      const phoneNumberRepository = await getPhoneNumberRepository();
      const existingRoute = await phoneNumberRepository.findByPhoneNumberId(selected.phoneNumberId);
      if (existingRoute?.organizationId && existingRoute.organizationId !== organizationId) {
        const error = new EmbeddedSignupError("phone_already_connected", "This WhatsApp phone number is already connected to a different organization.");
        await this.recordFailure(organizationId, context, error);
        throw error;
      }

      try {
        await subscribeAppToWaba(input.wabaId, accessToken);
      } catch (error) {
        await this.recordFailure(organizationId, context, error);
        throw error;
      }

      // Idempotent reconnect: if this organization previously connected
      // a DIFFERENT phone number, release that old routing entry so it
      // stops pointing here — never leaves two numbers routing to the
      // same org after a deliberate switch.
      const priorConnection = await integrationService.getIntegration(WHATSAPP_PROVIDER_ID);
      const priorPhoneNumberId = priorConnection?.config?.phoneNumberId as string | undefined;
      if (priorPhoneNumberId && priorPhoneNumberId !== selected.phoneNumberId) {
        await phoneNumberRepository.clearOrganization(priorPhoneNumberId);
      }

      // Module 8.2's own credential write path — this module never
      // touches encryption or the IntegrationConnection model directly.
      // `config` mirrors the non-secret phoneNumberId/wabaId in plain
      // text (for cheap display/routing reads — see
      // integrationService.setTenantCredentials's own doc comment on
      // why this is safe); `markConnected: true` is what makes this
      // organization's own connection status genuinely reflect
      // "connected" rather than this deployment's env-derived default
      // (see toSummary's own preferTenantStatus doc comment).
      const credentialResult = await integrationService.setTenantCredentials(
        WHATSAPP_PROVIDER_ID,
        { accessToken, phoneNumberId: selected.phoneNumberId, businessAccountId: input.wabaId },
        context,
        { config: { phoneNumberId: selected.phoneNumberId, businessAccountId: input.wabaId }, markConnected: true },
      );
      if (!credentialResult.success) {
        const error = new EmbeddedSignupError("exchange_failed", credentialResult.error.message);
        await this.recordFailure(organizationId, context, error);
        throw error;
      }

      // Module 2.3's own health/routing table, extended (not duplicated)
      // for Module 8.5's routing need — the same upsertHealth() call the
      // scheduled health-check job already uses, called here once at
      // connection time as this module's own "post-connection health
      // check," per the mission's explicit instruction to reuse this
      // architecture rather than build a second monitoring system.
      await phoneNumberService.upsertHealth({
        phoneNumberId: selected.phoneNumberId,
        displayPhoneNumber: selected.displayPhoneNumber,
        qualityRating: selected.qualityRating,
        wabaId: input.wabaId,
        verificationStatus: selected.verificationStatus,
        organizationId,
      });

      await auditLogService.record({
        action: AUDIT_ACTIONS.WHATSAPP_SIGNUP_PHONE_CONNECTED,
        entityType: "Integration",
        entityId: WHATSAPP_PROVIDER_ID,
        actorId: context.actorId,
        requestId: context.requestId,
        metadata: { organizationId, phoneNumberId: selected.phoneNumberId, wabaId: input.wabaId },
      });
      await auditLogService.record({
        action: AUDIT_ACTIONS.WHATSAPP_SIGNUP_WEBHOOK_CONFIGURED,
        entityType: "Integration",
        entityId: WHATSAPP_PROVIDER_ID,
        actorId: context.actorId,
        requestId: context.requestId,
        metadata: { organizationId, wabaId: input.wabaId },
      });
      await auditLogService.record({
        action: priorConnection?.credentialRef.type === "tenant_secret" ? AUDIT_ACTIONS.WHATSAPP_SIGNUP_REAUTHORIZED : AUDIT_ACTIONS.WHATSAPP_SIGNUP_CONNECTED,
        entityType: "Integration",
        entityId: WHATSAPP_PROVIDER_ID,
        actorId: context.actorId,
        requestId: context.requestId,
        metadata: { organizationId, phoneNumberId: selected.phoneNumberId },
      });

      logger.info("whatsapp.embedded_signup.connected", { organizationId, phoneNumberId: selected.phoneNumberId });

      return this.getConnectionSummary(organizationId);
    });
  },

  /** Never logs the underlying error's own raw text if it might carry
   *  a token/secret fragment (Meta's own error payloads are plain
   *  human-readable messages, not credential-shaped, but this stays
   *  defensive) — only a short, safe classification plus the thrown
   *  error's own already-safe `.message`. */
  async recordFailure(organizationId: string, context: AuditContext, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : "Unknown error.";
    await auditLogService
      .record({
        action: AUDIT_ACTIONS.WHATSAPP_SIGNUP_FAILED,
        entityType: "Integration",
        entityId: WHATSAPP_PROVIDER_ID,
        actorId: context.actorId,
        requestId: context.requestId,
        metadata: { organizationId, reason: message },
      })
      .catch(() => undefined);
    logger.warn("whatsapp.embedded_signup.failed", { organizationId, reason: message });
  },

  /**
   * Safe disconnect: revokes what can be revoked, clears the stored
   * credential, disables future sends — never deletes historical
   * Conversations/Messages/Activities/audit history, and never removes
   * the PhoneNumberRecord row's own health history (only its
   * organizationId ownership, so it stops routing new inbound
   * webhooks here and a future different organization could
   * legitimately claim the same number if Meta ever reassigns it).
   */
  async disconnect(organizationId: string, context: AuditContext = {}): Promise<void> {
    await runWithTenantContext({ organizationId }, async () => {
      const existing = await integrationService.getIntegration(WHATSAPP_PROVIDER_ID);
      const phoneNumberId = existing?.config?.phoneNumberId as string | undefined;
      const wabaId = existing?.config?.businessAccountId as string | undefined;

      // Best-effort, real revocation of this app's own webhook
      // subscription on the tenant's WABA — never allowed to block the
      // local disconnect: a revoked/expired token failing this call is
      // expected (the connection is being torn down either way).
      if (wabaId && existing?.credentialRef.type === "tenant_secret") {
        const { accessToken } = await resolveTenantCredentials(organizationId, WHATSAPP_PROVIDER_ID, ["accessToken"]);
        if (accessToken) await unsubscribeAppFromWaba(wabaId, accessToken);
      }

      const clearResult = await integrationService.clearTenantCredentials(WHATSAPP_PROVIDER_ID, context);
      if (!clearResult.success && clearResult.error.code !== "not_connected") {
        throw new EmbeddedSignupError("exchange_failed", clearResult.error.message);
      }

      if (phoneNumberId) {
        const phoneNumberRepository = await getPhoneNumberRepository();
        await phoneNumberRepository.clearOrganization(phoneNumberId);
      }

      await auditLogService.record({
        action: AUDIT_ACTIONS.WHATSAPP_SIGNUP_DISCONNECTED,
        entityType: "Integration",
        entityId: WHATSAPP_PROVIDER_ID,
        actorId: context.actorId,
        requestId: context.requestId,
        metadata: { organizationId, phoneNumberId },
      });
      logger.info("whatsapp.embedded_signup.disconnected", { organizationId, phoneNumberId });
    });
  },

  /**
   * The one function that computes the mission's own named rich
   * connection states from real, current facts — never a stored,
   * independently-driftable status field. Called by the status API
   * route and reused verbatim by the admin UI's own state badge.
   */
  async getConnectionSummary(organizationId: string): Promise<WhatsAppConnectionSummary> {
    return runWithTenantContext({ organizationId }, async () => {
      const connection = await integrationService.getIntegration(WHATSAPP_PROVIDER_ID);
      const isTenantConnected = connection?.credentialRef.type === "tenant_secret";

      if (!connection || !isTenantConnected) {
        return { state: "not_connected" as WhatsAppConnectionState };
      }

      const phoneNumberId = connection.config?.phoneNumberId as string | undefined;
      const phoneNumberRepository = await getPhoneNumberRepository();
      const route = phoneNumberId ? await phoneNumberRepository.findByPhoneNumberId(phoneNumberId) : null;

      let state: WhatsAppConnectionState = "connected";
      if (connection.lastError?.startsWith("token_expired")) state = "token_expired";
      else if (connection.lastError?.startsWith("webhook_error")) state = "webhook_error";
      else if (connection.health === "error") state = "action_required";
      else if (route?.verificationStatus === "not_verified") state = "phone_verification_required";
      else if (connection.health === "ok") state = "healthy";

      return {
        state,
        displayPhoneNumber: route?.displayPhoneNumber,
        phoneNumberId,
        wabaId: route?.wabaId,
        qualityRating: route?.qualityRating,
        verificationStatus: route?.verificationStatus,
        lastCheckedAt: route?.lastCheckedAt,
        lastError: connection.lastError,
        connectedAt: connection.lastSuccessAt,
      };
    });
  },

  /**
   * Post-connection (and periodic) verification — re-checks the
   * organization's own credentials against Meta directly via the
   * already-tenant-aware `whatsappService.getPhoneNumberHealth()`
   * (Module 2.3's own health check, reused verbatim). A failure here
   * is recorded as a classified `lastError` prefix so
   * `getConnectionSummary` can distinguish "token expired" from a
   * generic webhook/health problem, without inventing a second status
   * field.
   */
  async runHealthCheck(organizationId: string): Promise<void> {
    await runWithTenantContext({ organizationId }, async () => {
      const health = await whatsappService.getPhoneNumberHealth();
      const repository = await getIntegrationConnectionRepository();

      if (!health) {
        await repository.update(WHATSAPP_PROVIDER_ID, { health: "error", lastFailureAt: new Date().toISOString(), lastError: "token_expired: Meta rejected the stored credentials." });
        return;
      }

      await phoneNumberService.upsertHealth({
        phoneNumberId: health.phoneNumberId,
        displayPhoneNumber: health.displayPhoneNumber,
        qualityRating: health.qualityRating,
        messagingLimit: health.messagingLimit,
        organizationId,
      });
      await repository.update(WHATSAPP_PROVIDER_ID, { health: "ok", lastSuccessAt: new Date().toISOString() });
    });
  },
};
