import { z } from "zod";
import { withUserDb } from "@/db/with-user-db";
import { entryRepos } from "@/db/repositories/entries";
import { userRepo } from "@/db/repositories/users";
import { dashboardRepo } from "@/db/repositories/dashboard";
import { ENTRY_KINDS, monthSchema, type EntryKind } from "@/lib/entries";
import { projectRecurrences, toEntryDto, type EntryDto } from "@/lib/entry-api";
import { addDays, currentYearMonth, monthDateRange, shiftMonth, todayInTimeZone } from "@/lib/date";
import { fromCents, sumAmounts, toCents } from "@/lib/money";

// UC-14 — every widget of the dashboard for one month, in one call.

export const dashboardQuerySchema = z.object({ month: monthSchema.optional() });

/** Widget 2: the largest categories by name, the rest folded into "Other" */
export const TOP_CATEGORIES = 6;
/** Widget 5 */
export const TOP_EXPENSES = 5;
/** Widget 6: from tomorrow up to this many days ahead */
export const UPCOMING_DAYS = 30;
/** Widgets 3 and 4 */
export const TREND_MONTHS = 12;

const ZERO = "0.00";

/**
 * % change from `previous` to `current`, one decimal. null when there's no
 * base to compare with (previous = 0). Relative to |previous|, so a balance
 * going from −100 to 50 reads as +150 %, not −150 %.
 */
export function percentChange(current: string, previous: string): number | null {
  const prev = toCents(previous.replace("-", ""));
  if (prev === BigInt(0)) return null;
  return roundPercent(signedCents(current) - signedCents(previous), prev);
}

/** BR-05: (incomes − expenses) ÷ incomes × 100, one decimal; null without incomes */
export function savingsRate(incomes: string, expenses: string): number | null {
  const inc = toCents(incomes);
  if (inc === BigInt(0)) return null;
  return roundPercent(inc - toCents(expenses), inc);
}

/** part ÷ whole × 100, rounded to one decimal (exact integer math up to the last step) */
const roundPercent = (part: bigint, whole: bigint) =>
  Math.round(Number((part * BigInt(10000)) / whole) / 10) / 10;

const signedCents = (amount: string) =>
  amount.startsWith("-") ? -toCents(amount.slice(1)) : toCents(amount);

const signedAmount = (cents: bigint) =>
  cents < BigInt(0) ? `-${fromCents(-cents)}` : fromCents(cents);

/** BR-04: incomes − expenses − investments */
export function balanceOf(totals: Record<EntryKind, string>): string {
  return signedAmount(
    toCents(totals.INCOME) - toCents(totals.EXPENSE) - toCents(totals.INVESTMENT)
  );
}

export interface UpcomingItem {
  kind: EntryKind;
  /** Real entries are scheduled (dated after today); projections are recurrences not created yet */
  source: "scheduled" | "projected";
  id: string;
  categoryId: string;
  description: string | null;
  amount: string;
  entryDate: string;
  recurring: boolean;
}

export async function getDashboard(userId: string, requestedMonth?: string) {
  return withUserDb(userId, async (tx) => {
    const timezone = (await userRepo.findById(tx, userId))?.timezone ?? "America/Sao_Paulo";
    const today = todayInTimeZone(timezone);
    const month = requestedMonth ?? currentYearMonth(timezone);
    const range = monthDateRange(month);
    const firstMonth = shiftMonth(month, -(TREND_MONTHS - 1));
    const trendRange = { from: monthDateRange(firstMonth).from, to: range.to };

    const [
      hasData,
      incomeByMonth,
      expenseByMonth,
      investmentByMonth,
      investedBefore,
      byCategory,
      top,
    ] = await Promise.all([
      dashboardRepo.hasAnyEntry(tx),
      dashboardRepo.monthlyTotals(tx, "INCOME", trendRange.from, trendRange.to),
      dashboardRepo.monthlyTotals(tx, "EXPENSE", trendRange.from, trendRange.to),
      dashboardRepo.monthlyTotals(tx, "INVESTMENT", trendRange.from, trendRange.to),
      dashboardRepo.totalBefore(tx, "INVESTMENT", trendRange.from),
      dashboardRepo.expensesByCategory(tx, range.from, range.to),
      entryRepos.EXPENSE.list(tx, range, { sort: "amount_desc", limit: TOP_EXPENSES, offset: 0 }),
    ]);

    const totalsFor = (m: string): Record<EntryKind, string> => ({
      INCOME: incomeByMonth.get(m) ?? ZERO,
      EXPENSE: expenseByMonth.get(m) ?? ZERO,
      INVESTMENT: investmentByMonth.get(m) ?? ZERO,
    });

    // ── Widget 1: summary with change vs the previous month ──
    const current = totalsFor(month);
    const previous = totalsFor(shiftMonth(month, -1));
    const balance = balanceOf(current);
    const previousBalance = balanceOf(previous);
    const rate = savingsRate(current.INCOME, current.EXPENSE);
    const previousRate = savingsRate(previous.INCOME, previous.EXPENSE);
    const summary = {
      income: { total: current.INCOME, change: percentChange(current.INCOME, previous.INCOME) },
      expense: { total: current.EXPENSE, change: percentChange(current.EXPENSE, previous.EXPENSE) },
      investment: {
        total: current.INVESTMENT,
        change: percentChange(current.INVESTMENT, previous.INVESTMENT),
      },
      balance: { total: balance, change: percentChange(balance, previousBalance) },
      // Change in percentage points: a rate's % change would be a % of a %
      savingsRate: {
        rate,
        changePoints:
          rate !== null && previousRate !== null
            ? Math.round((rate - previousRate) * 10) / 10
            : null,
      },
    };

    // ── Widget 2: expenses by category, top 6 + Other ──
    const shown = byCategory.slice(0, TOP_CATEGORIES);
    const rest = byCategory.slice(TOP_CATEGORIES);
    const categories = {
      total: current.EXPENSE,
      slices: shown.map((c) => ({ categoryId: c.categoryId, total: c.total, count: c.count })),
      other:
        rest.length > 0
          ? {
              total: sumAmounts(rest.map((c) => c.total)),
              count: rest.reduce((n, c) => n + c.count, 0),
              categories: rest.length,
            }
          : null,
    };

    // ── Widgets 3 and 4: 12 months ending at the selected one ──
    let cumulative = toCents(investedBefore);
    const trend = Array.from({ length: TREND_MONTHS }, (_, i) => {
      const m = shiftMonth(firstMonth, i);
      const t = totalsFor(m);
      cumulative += toCents(t.INVESTMENT);
      return {
        month: m,
        income: t.INCOME,
        expense: t.EXPENSE,
        investment: t.INVESTMENT,
        balance: balanceOf(t),
        investedToDate: fromCents(cumulative),
      };
    });

    // ── Widget 6: the next 30 days — scheduled entries and recurrences still to come ──
    const window = { from: addDays(today, 1), to: addDays(today, UPCOMING_DAYS) };
    const windowMonths = [window.from.slice(0, 7), window.to.slice(0, 7)].filter(
      (m, i, all) => all.indexOf(m) === i
    );
    const upcoming: UpcomingItem[] = [];
    for (const kind of ENTRY_KINDS) {
      const scheduled = await entryRepos[kind].list(tx, window, {
        sort: "date_asc",
        limit: 100,
        offset: 0,
      });
      for (const e of scheduled) {
        upcoming.push({
          kind,
          source: "scheduled",
          id: e.id,
          categoryId: e.categoryId,
          description: e.description,
          amount: e.amount,
          entryDate: e.entryDate,
          recurring: !!e.recurrenceId,
        });
      }
      for (const m of windowMonths) {
        for (const p of await projectRecurrences(tx, kind, m, {})) {
          if (p.entryDate < window.from || p.entryDate > window.to) continue;
          upcoming.push({
            kind,
            source: "projected",
            id: `${p.recurrenceId}|${p.entryDate}`,
            categoryId: p.categoryId,
            description: p.description,
            amount: p.amount,
            entryDate: p.entryDate,
            recurring: true,
          });
        }
      }
    }
    upcoming.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.kind.localeCompare(b.kind));

    return {
      month,
      today,
      /** false → onboarding instead of empty charts */
      hasData,
      summary,
      categories,
      trend,
      topExpenses: top.map((e) => toEntryDto("EXPENSE", e, timezone)) as EntryDto[],
      upcoming,
    };
  });
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
