import { PgDialect, pgTable, uuid } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { organizationMemberships } from "./schema/organization-memberships";
import { MissingOrganizationIdError, adminBypassScope, orgScope } from "./tenant-scope";

const dialect = new PgDialect();

// Synthetic scoped table — proves `orgScope` works on any table that
// carries an `organization_id` column, not just `organization_memberships`.
const syntheticScopedTable = pgTable("synthetic", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
});

describe("orgScope", () => {
  it("builds a WHERE predicate equating organization_id to the given value", () => {
    const predicate = orgScope(organizationMemberships, "11111111-1111-1111-1111-111111111111");
    const { sql, params } = dialect.sqlToQuery(predicate);
    expect(sql).toContain('"organization_memberships"."organization_id"');
    expect(sql).toContain("=");
    expect(params).toEqual(["11111111-1111-1111-1111-111111111111"]);
  });

  it("works on any table carrying organization_id (not just the canonical schema)", () => {
    const predicate = orgScope(syntheticScopedTable, "22222222-2222-2222-2222-222222222222");
    const { sql, params } = dialect.sqlToQuery(predicate);
    expect(sql).toContain('"synthetic"."organization_id"');
    expect(params).toEqual(["22222222-2222-2222-2222-222222222222"]);
  });

  it("throws MissingOrganizationIdError when organizationId is an empty string", () => {
    expect(() => orgScope(organizationMemberships, "")).toThrow(MissingOrganizationIdError);
  });

  it("throws MissingOrganizationIdError when organizationId is missing at runtime", () => {
    // Simulating callers that forgot to pass an org id (e.g., from a request
    // context that wasn't populated by auth middleware).
    expect(() => orgScope(organizationMemberships, undefined as unknown as string)).toThrow(
      MissingOrganizationIdError,
    );
  });

  it("produces stable parameterized SQL (no inlined values) for the same input", () => {
    const first = dialect.sqlToQuery(orgScope(organizationMemberships, "abc"));
    const second = dialect.sqlToQuery(orgScope(organizationMemberships, "abc"));
    expect(first.sql).toBe(second.sql);
    expect(first.params).toEqual(second.params);
  });
});

describe("adminBypassScope", () => {
  it("returns undefined as an explicit opt-out marker", () => {
    expect(adminBypassScope()).toBeUndefined();
  });
});
