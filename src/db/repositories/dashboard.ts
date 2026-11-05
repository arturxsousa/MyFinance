import { and, desc, gte, isNull, lt, lte, sql, type AnyColumn } from "drizzle-orm";
import { income, expense, investment } from "../schema/entries";
import type { UserTx } from "../with-user-db";
import type { EntryKind } from "@/lib/categories";

// UC-14 aggregates. Run inside withUserDb: RLS limits every statement to the
// caller's rows. Sums are cast to text so cents stay exact (BR-02).

const TABLES = { INCOME: income, EXPENSE: expense, INVESTMENT: investment } as const;

const sumText = (column: AnyColumn) =>
  sql<string>`coalesce(sum(${column}), 0)::numeric(14,2)::text`;

export const dashboardRepo = {
  /** Total per "YYYY-MM" month of one kind, for entries dated in [from, to] */
  async monthlyTotals(
    tx: UserTx,
    kind: EntryKind,
    from: string,
    to: string
  ): Promise<Map<string, string>> {
    const t = TABLES[kind];
    const month = sql<string>`to_char(${t.entryDate}, 'YYYY-MM')`;
    const rows = await tx
      .select({ month, total: sumText(t.amount) })
      .from(t)
      .where(and(isNull(t.deletedAt), gte(t.entryDate, from), lte(t.entryDate, to)))
      .groupBy(month);
    return new Map(rows.map((r) => [r.month, r.total]));
  },

  /** Everything of one kind dated before `date` — the starting point of a cumulative line */
  async totalBefore(tx: UserTx, kind: EntryKind, date: string): Promise<string> {
    const t = TABLES[kind];
    const [row] = await tx
      .select({ total: sumText(t.amount) })
      .from(t)
      .where(and(isNull(t.deletedAt), lt(t.entryDate, date)));
    return row!.total;
  },

  /** The month's expenses per category, largest first */
  expensesByCategory(
    tx: UserTx,
    from: string,
    to: string
  ): Promise<{ categoryId: string; total: string; count: number }[]> {
    return tx
      .select({
        categoryId: expense.categoryId,
        total: sumText(expense.amount),
        count: sql<number>`count(*)::int`,
      })
      .from(expense)
      .where(
        and(isNull(expense.deletedAt), gte(expense.entryDate, from), lte(expense.entryDate, to))
      )
      .groupBy(expense.categoryId)
      .orderBy(desc(sql`sum(${expense.amount})`), expense.categoryId);
  },

  /** Whether the user has recorded anything at all — new users get onboarding */
  async hasAnyEntry(tx: UserTx): Promise<boolean> {
    const result = await tx.execute(sql`
      SELECT EXISTS (SELECT 1 FROM income WHERE deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM expense WHERE deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM investment WHERE deleted_at IS NULL) AS any
    `);
    return Boolean((result.rows[0] as { any: boolean } | undefined)?.any);
  },
};
