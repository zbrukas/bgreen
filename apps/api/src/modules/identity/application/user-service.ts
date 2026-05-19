import type { User } from "../domain/user.js";

export interface SyncUserInput {
  workosUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

// Application port — every adapter (Drizzle, in-memory test double) implements this.
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByWorkosUserId(workosUserId: string): Promise<User | null>;
  upsertFromWorkos(input: SyncUserInput): Promise<User>;
}

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async syncFromWorkos(input: SyncUserInput): Promise<User> {
    return this.repo.upsertFromWorkos(input);
  }

  async getByWorkosUserId(workosUserId: string): Promise<User | null> {
    return this.repo.findByWorkosUserId(workosUserId);
  }
}
