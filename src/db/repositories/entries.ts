import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { income, expense, investment } from "../schema/entries";
import type { UserTx } from "../with-user-db";

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeEntryRepo<TSelect, TInsert>(table: any) {
  return {
    listByMonth(tx: UserTx, year: number, month: number): Promise<TSelect[]> {
      const lastDay = new Date(year, month, 0).getDate();
      return tx
        .select()
        .from(table)
        .where(
          and(
            isNull(table.deletedAt),
            gte(table.entryDate, isoDate(year, month, 1)),
            lte(table.entryDate, isoDate(year, month, lastDay))
          )
        )
        .orderBy(table.entryDate);
    },

    async findById(tx: UserTx, id: string): Promise<TSelect | undefined> {
      const rows: TSelect[] = await (tx
        .select()
        .from(table)
        .where(and(eq(table.id, id), isNull(table.deletedAt))) as any);
      return rows[0];
    },

    async create(tx: UserTx, data: TInsert): Promise<TSelect> {
      const rows: TSelect[] = await (tx
        .insert(table)
        .values(data as any)
        .returning() as any);
      return rows[0]!;
    },

    async update(
      tx: UserTx,
      id: string,
      data: Partial<Omit<TInsert, "id" | "userId" | "createdAt">>
    ): Promise<TSelect | undefined> {
      const rows: TSelect[] = await tx
        .update(table)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(table.id, id), isNull(table.deletedAt)))
        .returning();
      return rows[0];
    },

    async softDelete(tx: UserTx, id: string): Promise<boolean> {
      const rows: { id: string }[] = await tx
        .update(table)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(table.id, id), isNull(table.deletedAt)))
        .returning({ id: table.id });
      return rows.length > 0;
    },
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export const incomeRepo = makeEntryRepo<typeof income.$inferSelect, typeof income.$inferInsert>(
  income
);

export const expenseRepo = makeEntryRepo<typeof expense.$inferSelect, typeof expense.$inferInsert>(
  expense
);

export const investmentRepo = makeEntryRepo<
  typeof investment.$inferSelect,
  typeof investment.$inferInsert
>(investment);
