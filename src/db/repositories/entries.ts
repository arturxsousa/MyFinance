import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { income, expense, investment } from "../schema/entries";
import type { UserTx } from "../with-user-db";

// All queries run inside withUserDb: RLS limits every statement to the
// caller's rows, so there are no explicit user_id filters here.

export interface EntryFilter {
  /** Inclusive calendar-date range, "YYYY-MM-DD" (BR-03: month of the entry date) */
  from: string;
  to: string;
  categoryId?: string;
  /** Free-text search on description and notes */
  q?: string;
}

export type EntrySortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

/** LIKE wildcards in user input are literal: "50%" searches for "50%" */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeEntryRepo<TSelect extends { id: string; userId: string }, TInsert>(table: any) {
  const notDeleted = isNull(table.deletedAt);

  function where(f: EntryFilter): SQL {
    const pattern = f.q ? `%${escapeLike(f.q)}%` : undefined;
    return and(
      notDeleted,
      gte(table.entryDate, f.from),
      lte(table.entryDate, f.to),
      f.categoryId ? eq(table.categoryId, f.categoryId) : undefined,
      pattern ? or(ilike(table.description, pattern), ilike(table.notes, pattern)) : undefined
    )!;
  }

  // id last: a stable order, so pages never repeat or skip rows
  const ORDER: Record<EntrySortKey, SQL[]> = {
    date_desc: [desc(table.entryDate), desc(table.createdAt), desc(table.id)],
    date_asc: [asc(table.entryDate), asc(table.createdAt), asc(table.id)],
    amount_desc: [desc(table.amount), desc(table.entryDate), desc(table.id)],
    amount_asc: [asc(table.amount), desc(table.entryDate), desc(table.id)],
  };

  return {
    list(
      tx: UserTx,
      filter: EntryFilter,
      opts: { sort: EntrySortKey; limit: number; offset: number }
    ): Promise<TSelect[]> {
      return tx
        .select()
        .from(table)
        .where(where(filter))
        .orderBy(...ORDER[opts.sort])
        .limit(opts.limit)
        .offset(opts.offset) as any;
    },

    /** Count and sum for the same filter — soft-deleted rows excluded (BR-04 totals) */
    async summary(tx: UserTx, filter: EntryFilter): Promise<{ count: number; total: string }> {
      const [row] = await tx
        .select({
          count: sql<number>`count(*)::int`,
          // numeric → text keeps exact cents; never parse money as a float
          total: sql<string>`coalesce(sum(${table.amount}), 0)::numeric(14,2)::text`,
        })
        .from(table)
        .where(where(filter));
      return row!;
    },

    async findById(tx: UserTx, id: string): Promise<TSelect | undefined> {
      const rows: TSelect[] = await (tx
        .select()
        .from(table)
        .where(and(eq(table.id, id), notDeleted)) as any);
      return rows[0];
    },

    /** Including soft-deleted rows — for restore */
    async findAnyById(
      tx: UserTx,
      id: string
    ): Promise<(TSelect & { deletedAt: Date | null }) | undefined> {
      const rows = await (tx.select().from(table).where(eq(table.id, id)) as any);
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
        .where(and(eq(table.id, id), notDeleted))
        .returning();
      return rows[0];
    },

    async softDelete(tx: UserTx, id: string): Promise<boolean> {
      const rows: { id: string }[] = await tx
        .update(table)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(table.id, id), notDeleted))
        .returning({ id: table.id });
      return rows.length > 0;
    },

    /** Undo a soft delete. Returns undefined if the row isn't deleted. */
    async restore(tx: UserTx, id: string): Promise<TSelect | undefined> {
      const rows: TSelect[] = await tx
        .update(table)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(and(eq(table.id, id), isNotNull(table.deletedAt)))
        .returning();
      return rows[0];
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type IncomeRow = typeof income.$inferSelect;
export type ExpenseRow = typeof expense.$inferSelect;
export type InvestmentRow = typeof investment.$inferSelect;
export type EntryRow = IncomeRow | ExpenseRow | InvestmentRow;

export const incomeRepo = makeEntryRepo<IncomeRow, typeof income.$inferInsert>(income);
export const expenseRepo = makeEntryRepo<ExpenseRow, typeof expense.$inferInsert>(expense);
export const investmentRepo = makeEntryRepo<InvestmentRow, typeof investment.$inferInsert>(
  investment
);

export const entryRepos = {
  INCOME: incomeRepo,
  EXPENSE: expenseRepo,
  INVESTMENT: investmentRepo,
} as const;
