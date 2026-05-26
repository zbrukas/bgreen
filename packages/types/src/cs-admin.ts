// V12.x list-query options for the CS admin tables under /cs/*.
//
// Each table has its own sort enum (the columns the API knows how to
// ORDER BY). `q` is case-insensitive substring search; the resource-side
// repo picks which columns to match.

import { z } from "zod";
import { CentralServicesRoleSchema } from "./organization-membership";

// ---- Domains list -------------------------------------------------------

export const CsDomainListSortSchema = z.enum(["domain", "createdAt"]);
export type CsDomainListSort = z.infer<typeof CsDomainListSortSchema>;

export const CsDomainListOptionsSchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  sort: CsDomainListSortSchema.optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type CsDomainListOptions = z.infer<typeof CsDomainListOptionsSchema>;

// ---- CS users list ------------------------------------------------------

export const CsUserListSortSchema = z.enum([
  "email",
  "role",
  "lastLoginAt",
  "createdAt",
]);
export type CsUserListSort = z.infer<typeof CsUserListSortSchema>;

export const CsUserListOptionsSchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  sort: CsUserListSortSchema.optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  role: CentralServicesRoleSchema.optional(),
});
export type CsUserListOptions = z.infer<typeof CsUserListOptionsSchema>;

// ---- CS orgs list -------------------------------------------------------

export const CsOrgListSortSchema = z.enum(["name", "createdAt"]);
export type CsOrgListSort = z.infer<typeof CsOrgListSortSchema>;

export const CsOrgListOptionsSchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  sort: CsOrgListSortSchema.optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  distrito: z.string().trim().min(1).max(60).optional(),
});
export type CsOrgListOptions = z.infer<typeof CsOrgListOptionsSchema>;
