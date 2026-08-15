import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  AppointmentTypeRepository,
  CreateAppointmentTypeInput,
  AppointmentType,
  UpdateAppointmentTypeInput,
} from "@/lib/services/crm/appointments/types";

const store: AppointmentType[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryAppointmentTypeRepository: AppointmentTypeRepository = {
  async findById(id: string): Promise<AppointmentType | null> {
    return findOwnedByTenant(store, (t) => t.id === id) ?? null;
  },

  // Deliberately searches the WHOLE store, not scopeToTenant(store) — the
  // in-memory equivalent of the mongodb repository's skipTenantScope
  // option: this is the one lookup a public request makes before any
  // tenant context exists at all.
  async findByPublicSlug(slug: string): Promise<AppointmentType | null> {
    return store.find((t) => t.publicSlug === slug) ?? null;
  },

  async create(input: CreateAppointmentTypeInput & { publicSlug: string }): Promise<AppointmentType> {
    if (store.some((t) => t.publicSlug === input.publicSlug)) {
      throw new DuplicateKeyError("AppointmentType", { publicSlug: input.publicSlug });
    }
    const type: AppointmentType = stampTenant<AppointmentType>({
      ...input,
      id: randomUUID(),
      active: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(type);
    return type;
  },

  async list(): Promise<AppointmentType[]> {
    return scopeToTenant(store).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async update(id: string, input: UpdateAppointmentTypeInput): Promise<AppointmentType> {
    const type = findOwnedByTenant(store, (t) => t.id === id);
    if (!type) throw new Error(`AppointmentType ${id} not found`);
    Object.assign(type, input, { updatedAt: nowIso() });
    return type;
  },

  async delete(id: string): Promise<void> {
    const type = findOwnedByTenant(store, (t) => t.id === id);
    if (!type) return;
    const index = store.findIndex((t) => t.id === id);
    if (index !== -1) store.splice(index, 1);
  },
};
