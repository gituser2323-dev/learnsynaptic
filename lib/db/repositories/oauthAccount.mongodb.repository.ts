import { getConnection } from "@/lib/db/connection";
import { OAuthAccountModel, toOAuthAccount } from "@/lib/db/models/oauthAccount.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type { CreateOAuthAccountInput, OAuthAccountRepository, OAuthProviderId } from "@/lib/services/auth/types";

export const mongodbOAuthAccountRepository: OAuthAccountRepository = {
  async create(input: CreateOAuthAccountInput) {
    await getConnection();
    try {
      const doc = await OAuthAccountModel.create(input);
      return toOAuthAccount(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new DuplicateKeyError("OAuthAccount", { provider: input.provider, providerAccountId: input.providerAccountId });
      }
      throw error;
    }
  },

  async findByProviderAccount(provider: OAuthProviderId, providerAccountId: string) {
    await getConnection();
    const doc = await OAuthAccountModel.findOne({ provider, providerAccountId }).exec();
    return doc ? toOAuthAccount(doc) : null;
  },

  async listByUserId(userId: string) {
    await getConnection();
    const docs = await OAuthAccountModel.find({ userId }).exec();
    return docs.map(toOAuthAccount);
  },

  async delete(id: string): Promise<void> {
    await getConnection();
    await OAuthAccountModel.deleteOne({ _id: id }).exec();
  },
};
