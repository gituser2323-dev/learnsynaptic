import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { DataExportRequestModel, toDataExportRequest } from "@/lib/db/models/dataExportRequest.model";
import type {
  CreateDataExportRequestInput,
  DataExportRequest,
  DataExportRequestRepository,
  UpdateDataExportRequestInput,
} from "@/lib/services/dataExport/types";

export const mongodbDataExportRequestRepository: DataExportRequestRepository = {
  async findById(id: string): Promise<DataExportRequest | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await DataExportRequestModel.findById(id).exec();
    return doc ? toDataExportRequest(doc) : null;
  },

  async create(input: CreateDataExportRequestInput): Promise<DataExportRequest> {
    await getConnection();
    const doc = await DataExportRequestModel.create(input);
    return toDataExportRequest(doc);
  },

  async update(id: string, input: UpdateDataExportRequestInput): Promise<DataExportRequest> {
    await getConnection();
    const doc = await DataExportRequestModel.findByIdAndUpdate(id, { $set: input }, { new: true }).exec();
    if (!doc) throw new Error(`DataExportRequest ${id} not found`);
    return toDataExportRequest(doc);
  },
};
