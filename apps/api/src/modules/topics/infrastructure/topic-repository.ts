import { db, schema } from "@bgreen/db";
import type { Topic } from "@bgreen/types";
import { eq } from "drizzle-orm";

export interface TopicRepository {
  list(): Promise<Topic[]>;
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
  async list(): Promise<Topic[]> {
    const rows = await db.select().from(schema.topics).orderBy(schema.topics.slug);
    return rows.map(rowToTopic);
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
