import { type SQL, eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

// Marker shape: any table that participates in multi-tenant scoping
// carries an `organizationId` column. The TS compiler can't enforce the
// column type without a phantom-type trick, so we accept any column here
// and rely on the convention.
export interface OrgScopedTable extends PgTable {
  organizationId: PgColumn;
}

export class MissingOrganizationIdError extends Error {
  constructor() {
    super(
      "orgScope: organizationId is required. Use adminBypassScope() for explicit cross-tenant reads.",
    );
    this.name = "MissingOrganizationIdError";
  }
}

/**
 * Build a WHERE predicate that restricts a query to a single organization.
 *
 * Throws if organizationId is falsy — admin/cross-tenant reads must use
 * `adminBypassScope` (a marker that's grep-able in code review).
 */
export function orgScope<T extends OrgScopedTable>(table: T, organizationId: string): SQL {
  if (!organizationId) {
    throw new MissingOrganizationIdError();
  }
  return eq(table.organizationId, organizationId);
}

/**
 * Explicit opt-out for cross-tenant reads (super-admin tooling, migrations,
 * background reconciliation). Returns `undefined`, signalling "no scope".
 * Grep `adminBypassScope` to audit every cross-tenant code path.
 */
export function adminBypassScope(): undefined {
  return undefined;
}
