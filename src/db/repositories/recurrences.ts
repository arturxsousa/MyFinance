import { eq } from "drizzle-orm";
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
};
