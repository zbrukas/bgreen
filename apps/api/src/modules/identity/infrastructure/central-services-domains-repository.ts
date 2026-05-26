import { db, schema } from "@bgreen/db";
import type { CsDomainListOptions } from "@bgreen/types";
import { type SQL, and, asc, count, desc, eq, ilike, or } from "drizzle-orm";

const DEFAULT_PAGE_SIZE = 10;

export interface CentralServicesDomainsRepository {
  // Returns true when the given email-domain (without "@") is registered.
  isCentralServicesDomain(domain: string): Promise<boolean>;
  // Admin CRUD lives in the CS console — V5.4f wires it up.
  list(options?: CsDomainListOptions): Promise<{
    items: Array<{ id: string; domain: string; note: string | null; createdAt: string }>;
    total: number;
  }>;
  insert(input: {
    domain: string;
    note: string | null;
    createdByUserId: string | null;
  }): Promise<void>;
  delete(id: string): Promise<void>;
}

export class DrizzleCentralServicesDomainsRepository implements CentralServicesDomainsRepository {
  async isCentralServicesDomain(domain: string): Promise<boolean> {
    const rows = await db
      .select({ id: schema.centralServicesDomains.id })
      .from(schema.centralServicesDomains)
      .where(eq(schema.centralServicesDomains.domain, domain.toLowerCase()))
      .limit(1);
    return rows.length > 0;
  }

  async list(options: CsDomainListOptions = {}) {
    const conditions: SQL[] = [];
    if (options.q) {
      const like = `%${options.q}%`;
      const search = or(
        ilike(schema.centralServicesDomains.domain, like),
        ilike(schema.centralServicesDomains.note, like),
      );
      if (search) conditions.push(search);
    }
    const column =
      options.sort === "domain"
        ? schema.centralServicesDomains.domain
        : schema.centralServicesDomains.createdAt;
    // createdAt defaults to desc (newest first); explicit name sort defaults asc.
    const defaultDir = options.sort === "domain" ? "asc" : "desc";
    const dir = options.dir ?? defaultDir;
    const order = dir === "asc" ? asc(column) : desc(column);
    const where = conditions.length === 0 ? undefined : and(...conditions);
    const paginate = options.page !== undefined || options.pageSize !== undefined;
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const page = options.page ?? 1;
    const offset = (page - 1) * pageSize;
    const dataQuery = db
      .select()
      .from(schema.centralServicesDomains)
      .where(where)
      .orderBy(order);
    const [rows, totalRow] = await Promise.all([
      paginate ? dataQuery.limit(pageSize).offset(offset) : dataQuery,
      db.select({ value: count() }).from(schema.centralServicesDomains).where(where),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        domain: r.domain,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
      total: totalRow[0]?.value ?? 0,
    };
  }

  async insert(input: { domain: string; note: string | null; createdByUserId: string | null }) {
    await db.insert(schema.centralServicesDomains).values({
      domain: input.domain.toLowerCase(),
      note: input.note,
      createdByUserId: input.createdByUserId,
    });
  }

  async delete(id: string) {
    await db.delete(schema.centralServicesDomains).where(eq(schema.centralServicesDomains.id, id));
  }
}
