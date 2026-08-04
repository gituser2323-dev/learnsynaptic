/** Custom Field domain layer — Enterprise CRM (Phase 1). One definition
 *  drives both validation and the admin UI's rendering for every field
 *  an institute adds to Lead — no schema migration per customer field.
 *  Values themselves live in Lead.customFields (a Mixed map, keyed by
 *  this definition's `key`), not a row-per-value table — appropriate
 *  since a lead typically carries a handful of custom values, read
 *  and written as a unit alongside the rest of the Lead record. */

export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "multiselect";

export interface CustomFieldDefinition {
  id: string;
  /** Stable machine key, e.g. "preferred_batch" — never renamed once
   *  values exist against it (a rename is delete + recreate, same
   *  reasoning as Tag having no rename either). */
  key: string;
  label: string;
  fieldType: CustomFieldType;
  /** Required for dropdown/radio/multiselect; ignored otherwise. */
  options?: string[];
  required: boolean;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomFieldDefinitionInput {
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options?: string[];
  required?: boolean;
  organizationId?: string;
}

export interface CustomFieldDefinitionRepository {
  findByKey(key: string): Promise<CustomFieldDefinition | null>;
  /** Throws DuplicateKeyError if the key already exists. */
  create(input: CreateCustomFieldDefinitionInput): Promise<CustomFieldDefinition>;
  list(): Promise<CustomFieldDefinition[]>;
  delete(id: string): Promise<void>;
}
