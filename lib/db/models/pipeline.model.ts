import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Pipeline, PipelineStage } from "@/lib/services/crm/pipelines/types";

export interface PipelineStageSubdocument {
  _id: Types.ObjectId;
  name: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

export interface PipelineDocument extends Document {
  name: string;
  isDefault: boolean;
  program?: string;
  stages: PipelineStageSubdocument[];
  organizationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const pipelineStageSchema = new Schema<PipelineStageSubdocument>({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  order: { type: Number, required: true },
  isWon: { type: Boolean, default: false },
  isLost: { type: Boolean, default: false },
});

const pipelineSchema = new Schema<PipelineDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    isDefault: { type: Boolean, default: false },
    program: { type: String, trim: true, maxlength: 100 },
    stages: { type: [pipelineStageSchema], default: [] },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: true },
);

function toStage(sub: PipelineStageSubdocument): PipelineStage {
  return { id: sub._id.toString(), name: sub.name, order: sub.order, isWon: sub.isWon, isLost: sub.isLost };
}

pipelineSchema.plugin(tenantScopePlugin);

export function toPipeline(doc: PipelineDocument): Pipeline {
  return {
    id: doc._id.toString(),
    name: doc.name,
    isDefault: doc.isDefault,
    program: doc.program,
    stages: doc.stages.map(toStage).sort((a, b) => a.order - b.order),
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const PipelineModel: Model<PipelineDocument> =
  (models.Pipeline as Model<PipelineDocument>) || model<PipelineDocument>("Pipeline", pipelineSchema);
