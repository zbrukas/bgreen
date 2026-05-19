import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  workosUserId: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type User = z.infer<typeof UserSchema>;
