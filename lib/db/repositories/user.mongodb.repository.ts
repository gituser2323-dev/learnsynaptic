import mongoose from "mongoose";
import { getConnection } from "@/lib/db/connection";
import { UserModel, toUser } from "@/lib/db/models/user.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type { CreateUserInput, UpdateUserInput, User, UserRepository } from "@/lib/services/auth/types";

/** RC-1 — translates UpdateUserInput's own "null clears the field,
 *  undefined leaves it untouched" convention into a real Mongo
 *  `$set`/`$unset` pair — a plain `findByIdAndUpdate(id, patch)` would
 *  otherwise silently no-op a `null`-valued field (Mongoose treats a
 *  literal `null` as "set to null," not "remove the field," and more
 *  importantly a plain object spread including `undefined` values gets
 *  stripped by Mongoose before reaching Mongo at all — see
 *  phoneNumber.mongodb.repository.ts's own `clearOrganization()` doc
 *  comment for the identical class of bug this avoids). */
function buildUserUpdateOperation(patch: UpdateUserInput): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) unset[key] = 1;
    else if (value !== undefined) set[key] = value;
  }
  const operation: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) operation.$set = set;
  if (Object.keys(unset).length > 0) operation.$unset = unset;
  return operation;
}

export const mongodbUserRepository: UserRepository = {
  async findByEmail(email: string): Promise<User | null> {
    await getConnection();
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).exec();
    return doc ? toUser(doc) : null;
  },

  async findById(id: string): Promise<User | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    await getConnection();
    const doc = await UserModel.findById(id).exec();
    return doc ? toUser(doc) : null;
  },

  async create(input: CreateUserInput): Promise<User> {
    await getConnection();
    try {
      const doc = await UserModel.create({ ...input, email: input.email.toLowerCase() });
      return toUser(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("User", { email: input.email });
      }
      throw error;
    }
  },

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    await getConnection();
    const doc = await UserModel.findByIdAndUpdate(id, { passwordHash }, { new: true }).exec();
    if (!doc) throw new Error(`User ${id} not found`);
    return toUser(doc);
  },

  async update(id: string, patch: UpdateUserInput): Promise<User> {
    await getConnection();
    const doc = await UserModel.findByIdAndUpdate(id, buildUserUpdateOperation(patch), { new: true }).exec();
    if (!doc) throw new Error(`User ${id} not found`);
    return toUser(doc);
  },

  async listActive(): Promise<User[]> {
    await getConnection();
    const docs = await UserModel.find({ status: "active" }).sort({ name: 1, email: 1 }).exec();
    return docs.map(toUser);
  },
};
