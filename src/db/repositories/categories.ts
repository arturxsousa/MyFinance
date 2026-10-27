import { and, eq, isNull, or } from "drizzle-orm";
import { category } from "../schema/categories";
import type { UserTx } from "../with-user-db";

type Category = typeof category.$inferSelect;
type NewCategory = typeof category.$inferInsert;
type CategoryKind = Category["kind"];

export const categoryRepo = {
  listByKind(tx: UserTx, kind: CategoryKind, userId: string): Promise<Category[]> {
    return tx
      .select()
      .from(category)
      .where(
        and(
          eq(category.kind, kind),
          eq(category.isActive, true),
          or(isNull(category.userId), eq(category.userId, userId))
        )
      )
      .orderBy(category.name);
  },

  async findById(tx: UserTx, id: string): Promise<Category | undefined> {
    const rows = await tx.select().from(category).where(eq(category.id, id));
    return rows[0];
  },

  async create(tx: UserTx, data: NewCategory): Promise<Category> {
    const rows = await tx.insert(category).values(data).returning();
    return rows[0]!;
  },

  async update(
    tx: UserTx,
    id: string,
    data: Partial<Pick<NewCategory, "name" | "color" | "isActive">>
  ): Promise<Category | undefined> {
    const rows = await tx
      .update(category)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(category.id, id))
      .returning();
    return rows[0];
  },
};
