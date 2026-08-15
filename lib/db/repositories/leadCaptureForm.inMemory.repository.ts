import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateLeadCaptureFormInput,
  LeadCaptureForm,
  LeadCaptureFormRepository,
  UpdateLeadCaptureFormInput,
} from "@/lib/services/crm/leadCaptureForms/types";

const store: LeadCaptureForm[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryLeadCaptureFormRepository: LeadCaptureFormRepository = {
  async findById(id: string): Promise<LeadCaptureForm | null> {
    return findOwnedByTenant(store, (f) => f.id === id) ?? null;
  },

  // Deliberately searches the WHOLE store, not scopeToTenant(store) — the
  // in-memory equivalent of the mongodb repository's skipTenantScope
  // option (see that file's own comment): this is the one lookup a
  // public request makes before any tenant context exists at all.
  async findByPublicSlug(slug: string): Promise<LeadCaptureForm | null> {
    return store.find((f) => f.publicSlug === slug) ?? null;
  },

  async create(input: CreateLeadCaptureFormInput & { publicSlug: string }): Promise<LeadCaptureForm> {
    if (store.some((f) => f.publicSlug === input.publicSlug)) {
      throw new DuplicateKeyError("LeadCaptureForm", { publicSlug: input.publicSlug });
    }
    const form: LeadCaptureForm = stampTenant<LeadCaptureForm>({
      ...input,
      id: randomUUID(),
      active: true,
      submissionCount: 0,
      duplicateCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(form);
    return form;
  },

  async list(): Promise<LeadCaptureForm[]> {
    return scopeToTenant(store).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async update(id: string, input: UpdateLeadCaptureFormInput): Promise<LeadCaptureForm> {
    const form = findOwnedByTenant(store, (f) => f.id === id);
    if (!form) throw new Error(`LeadCaptureForm ${id} not found`);
    Object.assign(form, input, { updatedAt: nowIso() });
    return form;
  },

  async delete(id: string): Promise<void> {
    const form = findOwnedByTenant(store, (f) => f.id === id);
    if (!form) return;
    const index = store.findIndex((f) => f.id === id);
    if (index !== -1) store.splice(index, 1);
  },

  async incrementCounts(id: string, options: { duplicate: boolean }): Promise<void> {
    const form = findOwnedByTenant(store, (f) => f.id === id);
    if (!form) return;
    form.submissionCount += 1;
    if (options.duplicate) form.duplicateCount += 1;
    form.updatedAt = nowIso();
  },
};
