import type { User } from "@bgreen/types";

export interface AuthContext {
  user: User;
  workosUserId: string;
}

// Hono <Env> shape used by every authenticated route.
export type AppEnv = {
  Variables: AuthContext;
};
