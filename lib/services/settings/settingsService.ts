import { WHATSAPP_ACTIVE_PROVIDER, META_CLOUD_API_CONFIG, AISENSY_CONFIG, INTERAKT_CONFIG, WATI_CONFIG, GALLABOX_CONFIG } from "@/config/whatsapp";
import { CSV_IMPORT_MAX_ROWS, MESSAGE_RETRY_POLICY } from "@/config/whatsappCampaigns";
import {
  MARKETING_ACTIVE_ADS_PROVIDER,
  MARKETING_ACTIVE_WEB_ANALYTICS_PROVIDER,
  META_ADS_CONFIG,
  GOOGLE_ANALYTICS_CONFIG,
} from "@/config/marketing";
import { IS_MONGODB_CONFIGURED } from "@/config/database";
import { AUDIT_LOG_RETENTION_DAYS } from "@/config/auditLog";
import { JWT_ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from "@/config/auth";
import type { AdminSettingsSnapshot } from "./types";

/**
 * Admin Dashboard — Settings page. Aggregates every config module's
 * *non-secret* summary into one read-only snapshot: which provider is
 * active, whether its credentials are set (booleans only — never the
 * actual API keys/tokens/secrets), and effective numeric policy values.
 * There is nothing to write here — every value already has its own
 * single source of truth in config/*.ts, sourced from env vars at
 * deploy time; an editable "Settings" UI would just be a second,
 * driftable copy of the same values.
 */
export function getSettingsSnapshot(): AdminSettingsSnapshot {
  return {
    whatsapp: {
      activeProvider: WHATSAPP_ACTIVE_PROVIDER,
      providersConfigured: {
        metaCloudApi: Boolean(META_CLOUD_API_CONFIG.phoneNumberId && META_CLOUD_API_CONFIG.accessToken),
        aisensy: Boolean(AISENSY_CONFIG.apiKey),
        interakt: Boolean(INTERAKT_CONFIG.apiKey),
        wati: Boolean(WATI_CONFIG.apiEndpoint && WATI_CONFIG.accessToken),
        gallabox: Boolean(GALLABOX_CONFIG.apiKey && GALLABOX_CONFIG.apiSecret),
      },
    },
    campaigns: {
      csvImportMaxRows: CSV_IMPORT_MAX_ROWS,
      retryPolicy: {
        maxAttempts: MESSAGE_RETRY_POLICY.maxAttempts,
        backoffMinutes: MESSAGE_RETRY_POLICY.backoffMinutes,
      },
    },
    marketing: {
      adsProvider: MARKETING_ACTIVE_ADS_PROVIDER,
      webAnalyticsProvider: MARKETING_ACTIVE_WEB_ANALYTICS_PROVIDER,
      adsConfigured: Boolean(META_ADS_CONFIG.accessToken && META_ADS_CONFIG.adAccountId),
      webAnalyticsConfigured: Boolean(
        GOOGLE_ANALYTICS_CONFIG.propertyId && GOOGLE_ANALYTICS_CONFIG.serviceAccountEmail,
      ),
    },
    database: {
      mongodbConfigured: IS_MONGODB_CONFIGURED,
    },
    auditLog: {
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
    },
    auth: {
      // Mirrors config/auth.ts's own >=32-char threshold without calling
      // resolveAccessTokenSecret() again — that would mint (and log) a
      // second throwaway random secret purely to check a boolean.
      jwtSecretConfigured: (process.env.JWT_ACCESS_TOKEN_SECRET?.length ?? 0) >= 32,
      accessTokenTtlSeconds: JWT_ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlSeconds: REFRESH_TOKEN_TTL_SECONDS,
    },
  };
}
