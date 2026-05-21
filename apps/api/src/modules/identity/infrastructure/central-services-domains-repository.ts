import { db, schema } from "@bgreen/db";
import { eq } from "drizzle-orm";

export interface CentralServicesDomainsRepository {
  // Returns true when the given email-domain (without "@") is registered.
  isCentralServicesDomain(domain: string): Promise<boolean>;
  // Admin CRUD lives in the CS console — V5.4f wires it up.
  list(): Promise<Array<{ id: string; domain: string; note: string | null; createdAt: string }>>;
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

  async list() {
    const rows = await db.select().from(schema.centralServicesDomains);
    return rows.map((r) => ({
      id: r.id,
      domain: r.domain,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    }));
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
