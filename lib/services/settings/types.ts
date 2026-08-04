/**
 * Admin Dashboard — Settings page. Read-only snapshot of active
 * configuration, never the raw secret values themselves (see
 * settingsService.ts's doc comment for why).
 */

export interface WhatsAppSettingsSnapshot {
  activeProvider: string;
  providersConfigured: {
    metaCloudApi: boolean;
    aisensy: boolean;
    interakt: boolean;
    wati: boolean;
    gallabox: boolean;
  };
}

export interface CampaignSettingsSnapshot {
  csvImportMaxRows: number;
  retryPolicy: {
    maxAttempts: number;
    backoffMinutes: number[];
  };
}

export interface MarketingSettingsSnapshot {
  adsProvider: string;
  webAnalyticsProvider: string;
  adsConfigured: boolean;
  webAnalyticsConfigured: boolean;
}

export interface DatabaseSettingsSnapshot {
  mongodbConfigured: boolean;
}

export interface AuditLogSettingsSnapshot {
  retentionDays: number;
}

export interface AuthSettingsSnapshot {
  jwtSecretConfigured: boolean;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
}

export interface AdminSettingsSnapshot {
  whatsapp: WhatsAppSettingsSnapshot;
  campaigns: CampaignSettingsSnapshot;
  marketing: MarketingSettingsSnapshot;
  database: DatabaseSettingsSnapshot;
  auditLog: AuditLogSettingsSnapshot;
  auth: AuthSettingsSnapshot;
}
