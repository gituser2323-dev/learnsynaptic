import { randomUUID } from "crypto";
import { findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateDataExportRequestInput,
  DataExportRequest,
  DataExportRequestRepository,
  UpdateDataExportRequestInput,
} from "@/lib/services/dataExport/types";

const store: DataExportRequest[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryDataExportRequestRepository: DataExportRequestRepository = {
  async findById(id: string): Promise<DataExportRequest | null> {
    return findOwnedByTenant(store, (r) => r.id === id) ?? null;
  },

  async create(input: CreateDataExportRequestInput): Promise<DataExportRequest> {
    const request: DataExportRequest = stampTenant<DataExportRequest>({
      ...input,
      id: randomUUID(),
      status: "pending",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(request);
    return request;
  },

  async update(id: string, input: UpdateDataExportRequestInput): Promise<DataExportRequest> {
    const request = findOwnedByTenant(store, (r) => r.id === id);
    if (!request) throw new Error(`DataExportRequest ${id} not found`);
    Object.assign(request, input, { updatedAt: nowIso() });
    return request;
  },
};
