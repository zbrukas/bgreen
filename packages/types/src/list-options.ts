// Shared list-query primitives used by every "table" admin endpoint.
//
// Each resource defines its own `sort` enum (the columns the API knows how
// to ORDER BY) and any resource-specific filters. The common shape is:
//
//   {
//     q?:   string         // free-text search, ILIKE %q%
//     sort?: <enum>        // resource-defined sort key
//     dir?:  "asc" | "desc"
//     ...resource filters
//   }
//
// Build the schema with `listOptionsSchema(sortValues)` and `.extend(...)`
// for resource-specific filters.

import { z } from "zod";

export const SortDirSchema = z.enum(["asc", "desc"]);
export type SortDir = z.infer<typeof SortDirSchema>;

// Shape factory: takes the allowed sort keys and returns a zod schema.
// All fields are optional — callers default behaviour at the repo layer.
export function listOptionsSchema<TSort extends string>(sortValues: readonly [TSort, ...TSort[]]) {
  return z.object({
    q: z.string().trim().min(1).max(200).optional(),
    sort: z.enum(sortValues).optional(),
    dir: SortDirSchema.optional(),
  });
}

export type ListOptions<TSort extends string, TExtra = Record<string, never>> = {
  q?: string;
  sort?: TSort;
  dir?: SortDir;
} & TExtra;
