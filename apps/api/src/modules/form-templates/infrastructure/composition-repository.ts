import { db, schema } from "@bgreen/db";
import { asc, eq, inArray } from "drizzle-orm";

export interface CompositionRepository {
  // Returns sub-template ids ordered by position asc, then by id for ties.
  listForMain(mainTemplateId: string): Promise<string[]>;
  // Returns a map mainId → ordered subIds. Single round-trip for batch lookups.
  listForMains(mainTemplateIds: string[]): Promise<Map<string, string[]>>;
  // Replaces the composition for a main template with the given ordered list.
  // Atomic: previous rows are deleted and new ones inserted in a transaction.
  setForMain(mainTemplateId: string, subTemplateIds: string[]): Promise<void>;
}

export class DrizzleCompositionRepository implements CompositionRepository {
  async listForMain(mainTemplateId: string): Promise<string[]> {
    const rows = await db
      .select({ subId: schema.templateCompositions.subTemplateId })
      .from(schema.templateCompositions)
      .where(eq(schema.templateCompositions.mainTemplateId, mainTemplateId))
      .orderBy(
        asc(schema.templateCompositions.position),
        asc(schema.templateCompositions.subTemplateId),
      );
    return rows.map((r) => r.subId);
  }

  async listForMains(mainTemplateIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>(mainTemplateIds.map((id) => [id, []]));
    if (mainTemplateIds.length === 0) return out;
    const rows = await db
      .select({
        mainId: schema.templateCompositions.mainTemplateId,
        subId: schema.templateCompositions.subTemplateId,
      })
      .from(schema.templateCompositions)
      .where(inArray(schema.templateCompositions.mainTemplateId, mainTemplateIds))
      .orderBy(
        asc(schema.templateCompositions.position),
        asc(schema.templateCompositions.subTemplateId),
      );
    for (const r of rows) {
      const list = out.get(r.mainId);
      if (list) list.push(r.subId);
    }
    return out;
  }

  async setForMain(mainTemplateId: string, subTemplateIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(schema.templateCompositions)
        .where(eq(schema.templateCompositions.mainTemplateId, mainTemplateId));
      if (subTemplateIds.length === 0) return;
      // Use spaced positions so future re-ordering can insert between rows
      // without renumbering everything.
      const values = subTemplateIds.map((subId, idx) => ({
        mainTemplateId,
        subTemplateId: subId,
        position: (idx + 1) * 10,
      }));
      await tx.insert(schema.templateCompositions).values(values);
    });
  }
}
