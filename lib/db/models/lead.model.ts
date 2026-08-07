import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { Lead, LeadStatus, LeadUtmParams } from "@/lib/services/leads/types";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+\d{10,15}$/;

export interface LeadDocument extends Document {
  name: string;
  email: string;
  phone: string;
  program?: string;
  source: string;
  message?: string;
  status: LeadStatus;
  utm?: LeadUtmParams;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  /** Enterprise CRM (Phase 1) fields — see lib/services/leads/types.ts's
   *  Lead interface for the reasoning behind each. */
  tags: Types.ObjectId[];
  customFields: Record<string, unknown>;
  score: number;
  health: string;
  assignedCounsellorId?: Types.ObjectId;
  archived: boolean;
  /** RC-5 — Backup, Restore & Disaster Recovery: soft-delete only, same
   *  pattern as FileAsset.deletedAt. Distinct from `archived` (a
   *  workflow-visibility flag a counsellor toggles routinely) — this is
   *  set only by an admin bulk-delete action, and is what makes that
   *  action recoverable instead of a permanent `deleteMany`. */
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<LeadDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, match: EMAIL_RE },
    phone: { type: String, required: true, match: E164_RE },
    program: { type: String, trim: true },
    source: { type: String, required: true, trim: true },
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ["new", "contacted", "nurture", "registered", "closed"],
      default: "new",
    },
    utm: {
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
      utmContent: String,
      utmTerm: String,
    },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    tags: { type: [Schema.Types.ObjectId], ref: "Tag", default: [] },
    customFields: { type: Schema.Types.Mixed, default: {} },
    score: { type: Number, default: 0, min: 0, max: 100 },
    health: { type: String, enum: ["hot", "warm", "cold"], default: "cold" },
    assignedCounsellorId: { type: Schema.Types.ObjectId, ref: "User" },
    archived: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

// Dedup lookups (see ARCHITECTURE.md §6.3) — compound, not unique: a
// repeat submission updates the existing lead via leadService, it isn't
// rejected at the database layer.
leadSchema.index({ phone: 1, email: 1 });
// Enterprise CRM (Phase 1) — Lead Search/filter access patterns.
leadSchema.index({ tags: 1 });
leadSchema.index({ assignedCounsellorId: 1 });
leadSchema.index({ health: 1 });
leadSchema.index({ archived: 1 });
leadSchema.index({ deletedAt: 1 });
// Business OS Phase 8, Module 8.1 — organizationId-led compound index:
// tenantScopePlugin now adds `organizationId` to every query this
// model receives (see that file's own module doc), so the highest-
// traffic list/filter query (the admin Leads page's own default view)
// is genuinely "this org's leads, newest first" — this index serves
// that shape directly instead of falling back to the single-field
// `archived`/`health` indexes above plus an in-memory sort. Lead is
// this pass's one representative example of this optimization, not a
// claim every index in this codebase got the same compound treatment —
// see the Module 8.1 audit entry's own disclosed follow-up list.
leadSchema.index({ organizationId: 1, createdAt: -1 });
// Business OS Phase 8, Module 8.1 — real tenant-scoped querying, not
// just a schema field. See tenantScopePlugin.ts's own module doc.
leadSchema.plugin(tenantScopePlugin);

export function toLead(doc: LeadDocument): Lead {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    program: doc.program,
    source: doc.source,
    message: doc.message,
    status: doc.status,
    utm: doc.utm,
    organizationId: doc.organizationId?.toString(),
    tags: doc.tags.map((t) => t.toString()),
    customFields: doc.customFields ?? {},
    score: doc.score,
    health: doc.health as Lead["health"],
    assignedCounsellorId: doc.assignedCounsellorId?.toString(),
    archived: doc.archived,
    deletedAt: doc.deletedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

// Reusing an existing compiled model guards against Next.js dev-mode hot
// reload trying to redefine "Lead" on every file change, which Mongoose
// otherwise throws OverwriteModelError on.
export const LeadModel: Model<LeadDocument> =
  (models.Lead as Model<LeadDocument>) || model<LeadDocument>("Lead", leadSchema);
