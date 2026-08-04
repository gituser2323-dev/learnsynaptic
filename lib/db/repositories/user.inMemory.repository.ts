import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import type { CreateUserInput, UpdateUserInput, User, UserRepository } from "@/lib/services/auth/types";

/**
 * Default/dev repository — module-level array, no database required.
 * Selected by lib/db/registry.ts whenever MongoDB isn't configured. Same
 * caveat as every other in-memory repository: not suitable for
 * production (state doesn't survive a restart or a serverless cold
 * start), which is why scripts/createAdminUser.ts is only meaningfully
 * durable once MONGODB_URI is configured.
 */
const store: User[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryUserRepository: UserRepository = {
  async findByEmail(email: string): Promise<User | null> {
    const lower = email.toLowerCase();
    return store.find((u) => u.email === lower) ?? null;
  },

  async findById(id: string): Promise<User | null> {
    return store.find((u) => u.id === id) ?? null;
  },

  async create(input: CreateUserInput): Promise<User> {
    const email = input.email.toLowerCase();
    if (store.some((u) => u.email === email)) {
      throw new DuplicateKeyError("User", { email });
    }
    const user: User = {
      ...input,
      email,
      status: input.status ?? "active",
      id: randomUUID(),
      failedLoginAttempts: 0,
      mfaEnabled: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    store.push(user);
    return user;
  },

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    const user = store.find((u) => u.id === id);
    if (!user) throw new Error(`User ${id} not found`);
    user.passwordHash = passwordHash;
    user.updatedAt = nowIso();
    return user;
  },

  /** RC-1 — same "null clears the field, undefined leaves it alone"
   *  convention the Mongo repository's own buildUserUpdateOperation()
   *  implements — `delete user[key]` is the in-memory equivalent of a
   *  real `$unset`. */
  async update(id: string, patch: UpdateUserInput): Promise<User> {
    const user = store.find((u) => u.id === id);
    if (!user) throw new Error(`User ${id} not found`);
    const mutableUser = user as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete mutableUser[key];
      else if (value !== undefined) mutableUser[key] = value;
    }
    user.updatedAt = nowIso();
    return user;
  },

  async listActive(): Promise<User[]> {
    return store
      .filter((u) => u.status === "active")
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
  },
};
