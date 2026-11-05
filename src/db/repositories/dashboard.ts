import { and, desc, gte, isNull, lte, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { expense } from "../schema/entries";
import type { UserTx } from "../with-user-db";
import type { EntryKind } from "@/lib/categories";

// UC-14 aggregates. Run inside withUserDb: RLS limits every statement to the
// caller's rows. Sums are cast to text so cents stay exact (BR-02).
//
// The dashboard is round-trip bound, not CPU bound: each query is one trip to
// the database, so related aggregates are fetched together with UNION ALL.

const sumText = (column: AnyColumn) =>
  sql<string>`coalesce(sum(${column}), 0)::numeric(14,2)::text`;

async function rows<T>(tx: UserTx, query: SQL): Promise<T[]> {
  return (await tx.execute(query)).rows as T[];
}

export interface DashboardTotals {
  /** kind → "YYYY-MM" → total, for months in the window */
  byMonth: Record<EntryKind, Map<string, string>>;
  /** Everything invested before the window — where the cumulative line starts */
  investedBefore: string;
  /** Whether the user has recorded anything at all — new users get onboarding */
  hasData: boolean;
}

export interface UpcomingRow {
  kind: EntryKind;
  id: string;
  category_id: string;
  description: string | null;
  amount: string;
  entry_date: string;
  recurrence_id: string | null;
}

export const dashboardRepo = {
  /** Monthly totals of the three kinds in [from, to], plus the two scalars, in one query */
  async totals(tx: UserTx, from: string, to: string): Promise<DashboardTotals> {
    const monthly = (table: string, kind: EntryKind) => sql`
      SELECT ${kind} AS kind, to_char(entry_date, 'YYYY-MM') AS month,
             sum(amount)::numeric(14,2)::text AS total
      FROM ${sql.identifier(table)}
      WHERE deleted_at IS NULL AND entry_date BETWEEN ${from} AND ${to}
      GROUP BY 2`;
    const result = await rows<{ kind: string; month: string | null; total: string }>(
      tx,
      sql`
        ${monthly("income", "INCOME")}
        UNION ALL ${monthly("expense", "EXPENSE")}
        UNION ALL ${monthly("investment", "INVESTMENT")}
        UNION ALL
        SELECT 'INVESTED_BEFORE', NULL, coalesce(sum(amount), 0)::numeric(14,2)::text
        FROM investment WHERE deleted_at IS NULL AND entry_date < ${from}
        UNION ALL
        SELECT 'HAS_DATA', NULL,
               (EXISTS (SELECT 1 FROM income WHERE deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM expense WHERE deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM investment WHERE deleted_at IS NULL))::text`
    );

    const totals: DashboardTotals = {
      byMonth: { INCOME: new Map(), EXPENSE: new Map(), INVESTMENT: new Map() },
      investedBefore: "0.00",
      hasData: false,
    };
    for (const r of result) {
      if (r.kind === "INVESTED_BEFORE") totals.investedBefore = r.total;
      else if (r.kind === "HAS_DATA") totals.hasData = r.total === "true";
      else totals.byMonth[r.kind as EntryKind].set(r.month!, r.total);
    }
    return totals;
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

  /** Entries of every kind dated in [from, to] — the scheduled part of "upcoming" */
  scheduledBetween(tx: UserTx, from: string, to: string, limit: number): Promise<UpcomingRow[]> {
    const part = (table: string, kind: EntryKind) => sql`
      SELECT ${kind} AS kind, id, category_id, description, amount::text AS amount,
             entry_date::text AS entry_date, recurrence_id
      FROM ${sql.identifier(table)}
      WHERE deleted_at IS NULL AND entry_date BETWEEN ${from} AND ${to}`;
    return rows<UpcomingRow>(
      tx,
      sql`(${part("income", "INCOME")}
           UNION ALL ${part("expense", "EXPENSE")}
           UNION ALL ${part("investment", "INVESTMENT")})
          ORDER BY entry_date, kind LIMIT ${limit}`
    );
  },

  /**
   * Dates already materialised for these recurrences in [from, to], in any
   * table, soft-deleted included (a deleted occurrence still holds its slot).
   */
  async generatedDates(
    tx: UserTx,
    recurrenceIds: string[],
    from: string,
    to: string
  ): Promise<Set<string>> {
    if (recurrenceIds.length === 0) return new Set();
    const ids = sql.join(
      recurrenceIds.map((id) => sql`${id}::uuid`),
      sql`, `
    );
    const part = (table: string) => sql`
      SELECT recurrence_id, entry_date::text AS entry_date FROM ${sql.identifier(table)}
      WHERE recurrence_id IN (${ids}) AND entry_date BETWEEN ${from} AND ${to}`;
    const result = await rows<{ recurrence_id: string; entry_date: string }>(
      tx,
      sql`${part("income")} UNION ALL ${part("expense")} UNION ALL ${part("investment")}`
    );
    return new Set(result.map((r) => `${r.recurrence_id}|${r.entry_date}`));
  },
};
