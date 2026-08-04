import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { WorkflowDefinitionRecord, PersistedWorkflowStep, WorkflowStepDelay } from "@/lib/services/automation/types";

export interface WorkflowDefinitionDocument extends Document<string> {
  name: string;
  triggerEventType: string;
  active: boolean;
  steps: PersistedWorkflowStep[];
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const delaySchema = new Schema<WorkflowStepDelay>(
  {
    amount: { type: Number, required: true },
    unit: { type: String, enum: ["minutes", "hours", "days"], required: true },
  },
  { _id: false },
);

const retryPolicySchema = new Schema(
  {
    maxAttempts: { type: Number, required: true },
    backoff: { type: delaySchema, required: true },
  },
  { _id: false },
);

const conditionSchema = new Schema(
  {
    type: { type: String, enum: ["lead_not_registered"], required: true },
    description: { type: String, required: true },
    params: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const actionSchema = new Schema(
  {
    type: { type: String, enum: ["send_whatsapp_template", "assign_lead", "add_tag", "create_task"], required: true },
    params: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const stepSchema = new Schema<PersistedWorkflowStep>(
  {
    id: { type: String, required: true },
    delay: { type: delaySchema, required: false },
    condition: { type: conditionSchema, required: false },
    action: { type: actionSchema, required: true },
    retryPolicy: { type: retryPolicySchema, required: false },
  },
  { _id: false },
);

/**
 * Business OS Phase 3, Module 3.1 — Persisted Workflow Definitions.
 *
 * `_id` is a caller-supplied string (e.g. "lead-nurture-sequence"), not
 * an auto-generated ObjectId — see WorkflowDefinitionRecord's own doc
 * comment (lib/services/automation/types.ts) for why: it's the same
 * identifier WorkflowRun.workflowId stores and triggers.ts looks up by,
 * and the migrated lead-nurture-sequence definition needs to keep that
 * exact identity for any WorkflowRun rows that already reference it.
 */
const workflowDefinitionSchema = new Schema<WorkflowDefinitionDocument>(
  {
    _id: { type: String },
    name: { type: String, required: true, trim: true },
    triggerEventType: { type: String, required: true },
    active: { type: Boolean, default: true },
    steps: { type: [stepSchema], default: [] },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

// triggers.ts's per-event lookup: every active definition for a given trigger.
workflowDefinitionSchema.index({ triggerEventType: 1, active: 1 });

workflowDefinitionSchema.plugin(tenantScopePlugin);

export function toWorkflowDefinitionRecord(doc: WorkflowDefinitionDocument): WorkflowDefinitionRecord {
  return {
    id: doc._id,
    name: doc.name,
    triggerEventType: doc.triggerEventType,
    active: doc.active,
    steps: doc.steps,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const WorkflowDefinitionModel: Model<WorkflowDefinitionDocument> =
  (models.WorkflowDefinition as Model<WorkflowDefinitionDocument>) ||
  model<WorkflowDefinitionDocument>("WorkflowDefinition", workflowDefinitionSchema);
