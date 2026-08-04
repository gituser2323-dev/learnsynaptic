import { Schema, model, models, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type {
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationCredentialRef,
  IntegrationHealthStatus,
} from "@/lib/services/integrations/types";

export interface IntegrationConnectionDocument extends Document {
  providerId: string;
  status: IntegrationConnectionStatus;
  enabled: boolean;
  config: Record<string, unknown>;
  credentialRef: IntegrationCredentialRef;
  health: IntegrationHealthStatus;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastError?: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const integrationConnectionSchema = new Schema<IntegrationConnectionDocument>(
  {
    // One connection row per provider today — no multi-tenant scoping
    // yet (see IntegrationConnection's own doc comment), so this alone
    // is the natural unique key. Adding organizationId to this index
    // is the one real migration a future Phase 8 activation would need
    // here — deliberately not done speculatively now.
    providerId: { type: String, required: true },
    status: { type: String, enum: ["connected", "disconnected"], required: true, default: "disconnected" },
    enabled: { type: Boolean, required: true, default: false },
    // Mixed by necessity: config shape genuinely varies per provider
    // category (a webhook URL vs. a calendar sync preference vs. a
    // storage bucket name) — validated at the service boundary
    // (validation.ts) to reject anything credential-shaped, not at the
    // schema level.
    config: { type: Schema.Types.Mixed, default: {} },
    credentialRef: { type: Schema.Types.Mixed, required: true },
    health: { type: String, enum: ["unknown", "ok", "error"], required: true, default: "unknown" },
    lastSuccessAt: { type: Date },
    lastFailureAt: { type: Date },
    lastError: { type: String },
    organizationId: { type: String, index: true },
  },
  { timestamps: true },
);

// Business OS Phase 8, Module 8.1 — providerId is unique PER
// ORGANIZATION, not globally: two organizations each connecting their
// own Razorpay/AWS S3/etc. account is the whole point of real
// multi-tenancy — see integrationConnection.inMemory.repository.ts's
// own comment for the identical reasoning.
integrationConnectionSchema.index({ organizationId: 1, providerId: 1 }, { unique: true });

integrationConnectionSchema.plugin(tenantScopePlugin);

export function toIntegrationConnection(doc: IntegrationConnectionDocument): IntegrationConnection {
  return {
    id: doc._id.toString(),
    providerId: doc.providerId,
    status: doc.status,
    enabled: doc.enabled,
    config: doc.config ?? {},
    credentialRef: doc.credentialRef,
    health: doc.health,
    lastSuccessAt: doc.lastSuccessAt?.toISOString(),
    lastFailureAt: doc.lastFailureAt?.toISOString(),
    lastError: doc.lastError,
    organizationId: doc.organizationId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const IntegrationConnectionModel: Model<IntegrationConnectionDocument> =
  (models.IntegrationConnection as Model<IntegrationConnectionDocument>) ||
  model<IntegrationConnectionDocument>("IntegrationConnection", integrationConnectionSchema);
