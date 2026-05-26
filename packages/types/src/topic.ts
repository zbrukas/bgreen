import { z } from "zod";

// Slug rules: lower-case ASCII, digits, underscore or dash. Stable identifier
// shared with FGA warrants and membership.topic_scope.
export const TopicSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "use lowercase letters, digits, '-' or '_'");
export type TopicSlug = z.infer<typeof TopicSlugSchema>;

export const TopicSchema = z.object({
  id: z.string().uuid(),
  slug: TopicSlugSchema,
  name: z.string().min(1).max(120),
  createdByUserId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type Topic = z.infer<typeof TopicSchema>;

export const NewTopicInputSchema = z.object({
  slug: TopicSlugSchema,
  name: z.string().min(1).max(120),
});
export type NewTopicInput = z.infer<typeof NewTopicInputSchema>;

// V12.x list-query options for /topics.
export const TopicListSortSchema = z.enum(["slug", "name", "createdAt"]);
export type TopicListSort = z.infer<typeof TopicListSortSchema>;

export const TopicListOptionsSchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  sort: TopicListSortSchema.optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type TopicListOptions = z.infer<typeof TopicListOptionsSchema>;
