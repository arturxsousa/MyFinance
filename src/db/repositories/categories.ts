import { asc, eq, sql } from "drizzle-orm";
import { category } from "../schema/categories";
import type { UserTx } from "../with-user-db";

type Category = typeof category.$inferSelect;
type CategoryKind = Category["kind"];

// All queries run inside withUserDb: RLS limits reads to system + own rows and
// writes to own rows, so no explicit user_id filters are needed here.

function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

export const categoryRepo = {
  /** System categories first, then own; archived included (callers filter). */
  list(tx: UserTx, kind?: CategoryKind): Promise<Category[]> {
    return tx
      .select()
      .from(category)
      .where(kind ? eq(category.kind, kind) : undefined)
      .orderBy(sql`${category.userId} IS NOT NULL`, asc(sql`lower(${category.name})`));
  },

  async findById(tx: UserTx, id: string): Promise<Category | undefined> {
    const rows = await tx.select().from(category).where(eq(category.id, id));
    return rows[0];
  },

  /** Returns null if the name is already taken for this user + kind. */
  async create(
    tx: UserTx,
    data: { userId: string; kind: CategoryKind; name: string; color: string }
  ): Promise<Category | null> {
    try {
      // Savepoint, so a unique violation doesn't abort the caller's transaction
      return await tx.transaction(async (sp) => {
        const rows = await sp.insert(category).values(data).returning();
        return rows[0]!;
      });
    } catch (err) {
      if (pgErrorCode(err) === "23505") return null;
      throw err;
    }
  },

  /** Returns null if the new name is already taken; undefined if not found. */
  async update(
    tx: UserTx,
    id: string,
    data: Partial<{ name: string; color: string; isActive: boolean }>
  ): Promise<Category | null | undefined> {
    try {
      return await tx.transaction(async (sp) => {
        const rows = await sp
          .update(category)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(category.id, id))
          .returning();
        return rows[0];
      });
    } catch (err) {
      if (pgErrorCode(err) === "23505") return null;
      throw err;
    }
  },

  /**
   * BR-06: hard-deletes an unused category; one still referenced by any entry,
   * recurrence or card purchase (soft-deleted ones included) is archived instead.
   * "In use" is decided by the FK constraints, so new referencing tables are covered.
   */
  async deleteOrArchive(tx: UserTx, id: string): Promise<"deleted" | "archived" | "not_found"> {
    try {
      const deleted = await tx.transaction(async (sp) =>
        sp.delete(category).where(eq(category.id, id)).returning({ id: category.id })
      );
      return deleted.length ? "deleted" : "not_found";
    } catch (err) {
      if (pgErrorCode(err) !== "23503") throw err; // foreign_key_violation → in use
      await tx
        .update(category)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(category.id, id));
      return "archived";
    }
  },
};
