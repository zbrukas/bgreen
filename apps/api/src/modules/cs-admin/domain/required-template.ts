import type { OrganizationRequiredTemplate, RequirementRecurrence } from "@bgreen/types";

// Re-export the shared zod-derived domain type. Keeping the alias
// inside the module's domain folder so importers don't reach into
// @bgreen/types directly — the module owns the contract here.
export type { OrganizationRequiredTemplate, RequirementRecurrence };
