import { getCustomFieldDefinitionRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { validateCreateCustomFieldDefinitionInput, type CustomFieldValidationError } from "./validation";
import type { CustomFieldDefinition } from "./types";

export type CreateCustomFieldDefinitionResult =
  | { success: true; definition: CustomFieldDefinition }
  | { success: false; errors: CustomFieldValidationError[] };

export const customFieldService = {
  async createDefinition(input: unknown, context: AuditContext = {}): Promise<CreateCustomFieldDefinitionResult> {
    const validation = validateCreateCustomFieldDefinitionInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const repository = await getCustomFieldDefinitionRepository();
    const definition = await repository.create(validation.data);
    await auditLogService.record({
      action: AUDIT_ACTIONS.CUSTOM_FIELD_DEFINED,
      entityType: "CustomFieldDefinition",
      entityId: definition.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { key: definition.key, fieldType: definition.fieldType },
    });
    return { success: true, definition };
  },

  async listDefinitions(): Promise<CustomFieldDefinition[]> {
    const repository = await getCustomFieldDefinitionRepository();
    return repository.list();
  },

  async deleteDefinition(id: string, context: AuditContext = {}): Promise<void> {
    const repository = await getCustomFieldDefinitionRepository();
    await repository.delete(id);
    await auditLogService.record({
      action: AUDIT_ACTIONS.CUSTOM_FIELD_DELETED,
      entityType: "CustomFieldDefinition",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
    });
  },
};
