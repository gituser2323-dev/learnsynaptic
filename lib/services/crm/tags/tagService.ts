import { getTagRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { validateCreateTagInput, type TagValidationError } from "./validation";
import type { Tag } from "./types";

export type CreateTagResult = { success: true; tag: Tag } | { success: false; errors: TagValidationError[] };

export const tagService = {
  async createTag(input: unknown, context: AuditContext = {}): Promise<CreateTagResult> {
    const validation = validateCreateTagInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const repository = await getTagRepository();
    const tag = await repository.create(validation.data);
    await auditLogService.record({
      action: AUDIT_ACTIONS.TAG_CREATED,
      entityType: "Tag",
      entityId: tag.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { label: tag.label },
    });
    return { success: true, tag };
  },

  async listTags(): Promise<Tag[]> {
    const repository = await getTagRepository();
    return repository.list();
  },

  async deleteTag(id: string, context: AuditContext = {}): Promise<void> {
    const repository = await getTagRepository();
    await repository.delete(id);
    await auditLogService.record({
      action: AUDIT_ACTIONS.TAG_DELETED,
      entityType: "Tag",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
    });
  },
};
