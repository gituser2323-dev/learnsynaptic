/** Tag domain layer — Enterprise CRM (Phase 1). A flat, reusable catalog;
 *  assignment onto a Lead lives as Lead.tags (an array of Tag ids), not
 *  a join collection — the same "denormalized array on the owning
 *  record" shape LeadUtmParams already uses, appropriate here since a
 *  lead rarely carries more than a handful of tags. */

export interface Tag {
  id: string;
  label: string;
  /** Hex color, e.g. "#2d4fd6" — validated in validation.ts. */
  color: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagInput {
  label: string;
  color: string;
  organizationId?: string;
}

export interface TagRepository {
  findById(id: string): Promise<Tag | null>;
  findByIds(ids: string[]): Promise<Tag[]>;
  /** Throws DuplicateKeyError if the label already exists. */
  create(input: CreateTagInput): Promise<Tag>;
  list(): Promise<Tag[]>;
  delete(id: string): Promise<void>;
}
