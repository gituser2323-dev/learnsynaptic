import { getConnection } from "@/lib/db/connection";
import { WorkflowDefinitionModel, toWorkflowDefinitionRecord } from "@/lib/db/models/workflowDefinition.model";
import type {
  CreateWorkflowDefinitionInput,
  UpdateWorkflowDefinitionInput,
  WorkflowDefinitionRecord,
  WorkflowDefinitionRepository,
} from "@/lib/services/automation/types";

export const mongodbWorkflowDefinitionRepository: WorkflowDefinitionRepository = {
  async create(input: CreateWorkflowDefinitionInput): Promise<WorkflowDefinitionRecord> {
    await getConnection();
    const doc = await WorkflowDefinitionModel.create({
      _id: input.id,
      name: input.name,
      triggerEventType: input.triggerEventType,
      active: input.active ?? true,
      steps: input.steps,
      organizationId: input.organizationId,
    });
    return toWorkflowDefinitionRecord(doc);
  },

  async findById(id: string): Promise<WorkflowDefinitionRecord | null> {
    await getConnection();
    const doc = await WorkflowDefinitionModel.findById(id).exec();
    return doc ? toWorkflowDefinitionRecord(doc) : null;
  },

  async list(): Promise<WorkflowDefinitionRecord[]> {
    await getConnection();
    const docs = await WorkflowDefinitionModel.find({}).sort({ createdAt: -1 }).exec();
    return docs.map(toWorkflowDefinitionRecord);
  },

  async findActiveByTriggerEventType(triggerEventType: string): Promise<WorkflowDefinitionRecord[]> {
    await getConnection();
    const docs = await WorkflowDefinitionModel.find({ triggerEventType, active: true }).exec();
    return docs.map(toWorkflowDefinitionRecord);
  },

  async update(id: string, patch: UpdateWorkflowDefinitionInput): Promise<WorkflowDefinitionRecord> {
    await getConnection();
    const doc = await WorkflowDefinitionModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!doc) throw new Error(`WorkflowDefinition ${id} not found`);
    return toWorkflowDefinitionRecord(doc);
  },

  async delete(id: string): Promise<void> {
    await getConnection();
    await WorkflowDefinitionModel.findByIdAndDelete(id).exec();
  },
};
