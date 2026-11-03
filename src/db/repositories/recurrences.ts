import { and, asc, eq } from "drizzle-orm";
import { recurrence } from "../schema/entries";
import type { UserTx } from "../with-user-db";

export type RecurrenceRow = typeof recurrence.$inferSelect;
type NewRecurrence = typeof recurrence.$inferInsert;

// Runs inside withUserDb: RLS limits every statement to the caller's rows.
export const recurrenceRepo = {
  async create(tx: UserTx, data: NewRecurrence): Promise<RecurrenceRow> {
    const rows = await tx.insert(recurrence).values(data).returning();
    return rows[0]!;
  },

  async findById(tx: UserTx, id: string): Promise<RecurrenceRow | undefined> {
    const rows = await tx.select().from(recurrence).where(eq(recurrence.id, id));
    return rows[0];
  },

  /** Active (not paused) recurrences of one kind — for projections */
  listActive(tx: UserTx, kind: RecurrenceRow["kind"]): Promise<RecurrenceRow[]> {
    return tx
      .select()
      .from(recurrence)
      .where(and(eq(recurrence.kind, kind), eq(recurrence.isActive, true)));
  },
  /** Every recurrence of the caller — paused and ended included (UC-13 page) */
  list(tx: UserTx): Promise<RecurrenceRow[]> {
    return tx
      .select()
      .from(recurrence)
      .orderBy(asc(recurrence.dayOfMonth), asc(recurrence.createdAt));
  },

  async update(
    tx: UserTx,
    id: string,
    data: Partial<
      Pick<
        NewRecurrence,
        | "amount"
        | "categoryId"
        | "description"
        | "paymentMethod"
        | "institution"
        | "endDate"
        | "isActive"
        | "lastGeneratedOn"
      >
    >
  ): Promise<RecurrenceRow | undefined> {
    const rows = await tx
      .update(recurrence)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(recurrence.id, id))
      .returning();
    return rows[0];
  },

  /** Generated entries are kept; their recurrence_id becomes NULL (FK ON DELETE SET NULL) */
  async delete(tx: UserTx, id: string): Promise<boolean> {
    const rows = await tx
      .delete(recurrence)
      .where(eq(recurrence.id, id))
      .returning({ id: recurrence.id });
    return rows.length > 0;
  },
};
