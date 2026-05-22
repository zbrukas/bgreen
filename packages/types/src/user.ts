import { z } from "zod";
import { CentralServicesRoleSchema, UserTypeSchema } from "./organization-membership";

export const UserSchema = z.object({
  id: z.string().uuid(),
  // V5.7: nullable for CS users (local password auth). Org users still
  // populate this via WorkOS sync.
  workosUserId: z.string().min(1).nullable(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  userType: UserTypeSchema,
  centralServicesRole: CentralServicesRoleSchema.nullable(),
  // V5.7: argon2 hash, only present for CS users that completed setup.
  passwordHash: z.string().nullable(),
  lastLoginAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type User = z.infer<typeof UserSchema>;
