import { db, schema } from "@bgreen/db";
import type { Topic, TopicListOptions } from "@bgreen/types";
import { type SQL, and, asc, count, desc, eq, ilike, or } from "drizzle-orm";

const DEFAULT_PAGE_SIZE = 10;

export interface TopicRepository {
  list(options?: TopicListOptions): Promise<{ items: Topic[]; total: number }>;
  findById(id: string): Promise<Topic | null>;
  findBySlug(slug: string): Promise<Topic | null>;
  insert(input: { slug: string; name: string; createdByUserId: string | null }): Promise<Topic>;
  delete(id: string): Promise<void>;
}

function rowToTopic(row: typeof schema.topics.$inferSelect): Topic {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleTopicRepository implements TopicRepository {
  async list(options: TopicListOptions = {}): Promise<{ items: Topic[]; total: number }> {
    const conditions: SQL[] = [];
    if (options.q) {
      const like = `%${options.q}%`;
      const search = or(ilike(schema.topics.slug, like), ilike(schema.topics.name, like));
      if (search) conditions.push(search);
    }
    const column = (() => {
      switch (options.sort) {
        case "name":
          return schema.topics.name;
        case "createdAt":
          return schema.topics.createdAt;
        default:
          return schema.topics.slug;
      }
    })();
    const order = options.dir === "desc" ? desc(column) : asc(column);
    const where = conditions.length === 0 ? undefined : and(...conditions);
    const paginate = options.page !== undefined || options.pageSize !== undefined;
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const page = options.page ?? 1;
    const offset = (page - 1) * pageSize;
    const dataQuery = db.select().from(schema.topics).where(where).orderBy(order);
    const [rows, totalRow] = await Promise.all([
      paginate ? dataQuery.limit(pageSize).offset(offset) : dataQuery,
      db.select({ value: count() }).from(schema.topics).where(where),
    ]);
    return { items: rows.map(rowToTopic), total: totalRow[0]?.value ?? 0 };
  }

  async findById(id: string): Promise<Topic | null> {
    const rows = await db.select().from(schema.topics).where(eq(schema.topics.id, id)).limit(1);
    const row = rows[0];
    return row ? rowToTopic(row) : null;
  }

  async findBySlug(slug: string): Promise<Topic | null> {
    const rows = await db.select().from(schema.topics).where(eq(schema.topics.slug, slug)).limit(1);
    const row = rows[0];
    return row ? rowToTopic(row) : null;
  }

  async insert(input: {
    slug: string;
    name: string;
    createdByUserId: string | null;
  }): Promise<Topic> {
    const [row] = await db
      .insert(schema.topics)
      .values({
        slug: input.slug,
        name: input.name,
        createdByUserId: input.createdByUserId,
      })
      .returning();
    if (!row) throw new Error("create topic: empty returning()");
    return rowToTopic(row);
  }

  async delete(id: string): Promise<void> {
    await db.delete(schema.topics).where(eq(schema.topics.id, id));
  }
}
