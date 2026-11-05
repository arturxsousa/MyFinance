import { z } from "zod";
import { withUserDb } from "@/db/with-user-db";
import { entryRepos } from "@/db/repositories/entries";
import { userRepo } from "@/db/repositories/users";
import { dashboardRepo } from "@/db/repositories/dashboard";
import { recurrenceRepo } from "@/db/repositories/recurrences";
import { monthSchema, type EntryKind } from "@/lib/entries";
import { toEntryDto, type EntryDto } from "@/lib/entry-api";
import { occurrenceIn } from "@/lib/recurrence-schedule";
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

    // One trip each; RLS scopes them to the caller
    const { byMonth, investedBefore, hasData } = await dashboardRepo.totals(
      tx,
      trendRange.from,
      trendRange.to
    );
    const byCategory = await dashboardRepo.expensesByCategory(tx, range.from, range.to);
    const top = await entryRepos.EXPENSE.list(tx, range, {
      sort: "amount_desc",
      limit: TOP_EXPENSES,
      offset: 0,
    });

    const totalsFor = (m: string): Record<EntryKind, string> => ({
      INCOME: byMonth.INCOME.get(m) ?? ZERO,
      EXPENSE: byMonth.EXPENSE.get(m) ?? ZERO,
      INVESTMENT: byMonth.INVESTMENT.get(m) ?? ZERO,
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
    const scheduled = await dashboardRepo.scheduledBetween(tx, window.from, window.to, 100);
    const upcoming: UpcomingItem[] = scheduled.map((e) => ({
      kind: e.kind,
      source: "scheduled" as const,
      id: e.id,
      categoryId: e.category_id,
      description: e.description,
      amount: e.amount,
      entryDate: e.entry_date,
      recurring: !!e.recurrence_id,
    }));

    // Recurrences' occurrences in the window not created yet (same rule as the
    // list pages' "Projected"): after last_generated_on and with no entry yet
    const candidates = (await recurrenceRepo.list(tx))
      .filter((r) => r.isActive)
      .flatMap((r) =>
        windowMonths
          .map((m) => occurrenceIn(m, r))
          .filter(
            (d): d is string =>
              !!d &&
              d >= window.from &&
              d <= window.to &&
              (!r.lastGeneratedOn || d > r.lastGeneratedOn)
          )
          .map((date) => ({ r, date }))
      );
    const existing = await dashboardRepo.generatedDates(
      tx,
      [...new Set(candidates.map((c) => c.r.id))],
      window.from,
      window.to
    );
    for (const { r, date } of candidates) {
      if (existing.has(`${r.id}|${date}`)) continue;
      upcoming.push({
        kind: r.kind,
        source: "projected",
        id: `${r.id}|${date}`,
        categoryId: r.categoryId,
        description: r.description,
        amount: r.amount,
        entryDate: date,
        recurring: true,
      });
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
